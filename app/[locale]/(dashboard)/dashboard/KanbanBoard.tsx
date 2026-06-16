'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import useSWR, { useSWRConfig } from 'swr';
import { useRouter } from 'next/navigation';
import { 
    Plus, MoreHorizontal, Loader2, 
    Pencil, Trash2, Clock, ChevronLeft, ChevronRight, MessageCircle 
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker from 'emoji-picker-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

type FunnelStage = {
  id: number;
  name: string;
  emoji: string;
  order: number;
};

type ChatCard = {
  id: number;
  remoteJid: string;
  name: string;
  profilePicUrl?: string;
  contactId: number;
  funnelStageId: number | null;
  lastMessageText: string;
  unreadCount: number;
  updatedAt: string;
  showTimeInStage: boolean;
  instanceId?: number;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function getDaysInStage(dateString: string) {
    if (!dateString) return 0;
    const updated = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - updated.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays;
}

export default function KanbanBoard() {
  const t = useTranslations('Dashboard');
  const { data: stagesData, isLoading: loadingStages, mutate: mutateStages } = useSWR<FunnelStage[]>('/api/funnel-stages', fetcher);
  const { data: chats, isLoading: loadingChats, mutate: mutateChats } = useSWR<any[]>('/api/chats?scope=kanban', fetcher);
  const { mutate: globalMutate } = useSWRConfig();

  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [columns, setColumns] = useState<Record<string, ChatCard[]>>({});
  
  const [isNewStageOpen, setIsNewStageOpen] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageEmoji, setNewStageEmoji] = useState('📌');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingStage, setEditingStage] = useState<FunnelStage | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stagesData) {
        setStages([...stagesData].sort((a, b) => a.order - b.order));
    }
  }, [stagesData]);

  useEffect(() => {
    if (stages.length > 0 && chats) {
      const newCols: Record<string, ChatCard[]> = {};
      stages.forEach(s => newCols[s.id] = []);
      newCols['unassigned'] = [];

      chats.forEach(chat => {
        const card: ChatCard = {
            id: chat.id,
            remoteJid: chat.remoteJid,
            name: chat.contact?.name || chat.name || chat.remoteJid,
            profilePicUrl: chat.profilePicUrl,
            contactId: chat.contact?.id,
            funnelStageId: chat.contact?.funnelStage?.id,
            lastMessageText: chat.lastMessageText,
            unreadCount: chat.unreadCount,
            updatedAt: chat.contact?.updatedAt || new Date().toISOString(),
            showTimeInStage: chat.contact?.showTimeInStage || false,
            instanceId: chat.instanceId
        };

        if (chat.contact && chat.contact.funnelStage) {
            const stageId = chat.contact.funnelStage.id;
            if (newCols[stageId]) newCols[stageId].push(card);
            else newCols['unassigned'].push(card);
        } else if (chat.contact) {
            newCols['unassigned'].push(card);
        }
      });
      setColumns(newCols);
    }
  }, [stages, chats]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === 'COLUMN') {
        const newStages = Array.from(stages);
        const [removed] = newStages.splice(source.index, 1);
        newStages.splice(destination.index, 0, removed);
        setStages(newStages);

        const reorderedPayload = newStages.map((s, index) => ({ id: s.id, order: index + 1 }));
        try {
            await fetch('/api/funnel-stages/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stages: reorderedPayload })
            });
            globalMutate('/api/funnel-stages');
        } catch (e) {
            toast.error(t('toast_error'));
            mutateStages();
        }
        return;
    }

    const sourceColId = source.droppableId;
    const destColId = destination.droppableId;
    const sourceItems = [...(columns[sourceColId] || [])];
    const destItems = sourceColId === destColId ? sourceItems : [...(columns[destColId] || [])];
    
    const [movedItem] = sourceItems.splice(source.index, 1);
    
    if (sourceColId !== destColId) {
        movedItem.updatedAt = new Date().toISOString();
    }

    if (sourceColId === destColId) {
        sourceItems.splice(destination.index, 0, movedItem);
        setColumns({ ...columns, [sourceColId]: sourceItems });
    } else {
        destItems.splice(destination.index, 0, movedItem);
        setColumns({ ...columns, [sourceColId]: sourceItems, [destColId]: destItems });
    }

    try {
        if (!movedItem.contactId) {
            mutateChats(); return;
        }
        const newStageId = destColId === 'unassigned' ? null : parseInt(destColId);
        await fetch(`/api/contacts/${movedItem.contactId}/funnel-stage`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stageId: newStageId })
        });
        globalMutate('/api/chats'); 
    } catch (error) {
        toast.error(t('toast_error'));
        mutateChats();
    }
  };

  const handleCreateStage = async () => {
    if (!newStageName.trim()) return;
    setIsProcessing(true);
    try {
        const res = await fetch('/api/funnel-stages', {
            method: 'POST',
            body: JSON.stringify({ name: newStageName, emoji: newStageEmoji })
        });
        if (!res.ok) throw new Error();
        toast.success(t('toast_created'));
        setNewStageName(''); setNewStageEmoji('📌'); setIsNewStageOpen(false);
        mutateStages();
    } catch { toast.error(t('toast_error')); } 
    finally { setIsProcessing(false); }
  };

  const handleUpdateStage = async () => {
    if (!editingStage || !editingStage.name.trim()) return;
    setIsProcessing(true);
    try {
        await fetch(`/api/funnel-stages/${editingStage.id}`, {
            method: 'PUT',
            body: JSON.stringify({ name: editingStage.name, emoji: editingStage.emoji })
        });
        toast.success(t('toast_updated'));
        setEditingStage(null);
        mutateStages();
    } catch { toast.error(t('toast_error')); }
    finally { setIsProcessing(false); }
  };

  const handleDeleteStage = async (id: number) => {
    if (!confirm(t('delete_confirm'))) return;
    try {
        await fetch(`/api/funnel-stages/${id}`, { method: 'DELETE' });
        toast.success(t('toast_deleted'));
        mutateStages(); mutateChats();
    } catch { toast.error(t('toast_error')); }
  };

  const handleToggleAlert = async (card: ChatCard) => {
      const newStatus = !card.showTimeInStage;
      const newCols = { ...columns };
      Object.keys(newCols).forEach(key => {
          const idx = newCols[key].findIndex(c => c.id === card.id);
          if (idx !== -1) newCols[key][idx] = { ...newCols[key][idx], showTimeInStage: newStatus };
      });
      setColumns(newCols);

      try {
        await fetch(`/api/contacts/${card.contactId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ showTimeInStage: newStatus })
          });
          globalMutate('/api/chats');
      } catch (e) {
          mutateChats();
      }
  };

  const scrollBoard = (direction: 'left' | 'right') => {
      if (scrollContainerRef.current) {
          const scrollAmount = 340; 
          scrollContainerRef.current.scrollBy({ 
              left: direction === 'left' ? -scrollAmount : scrollAmount, 
              behavior: 'smooth' 
          });
      }
  };

  if (loadingStages || loadingChats) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
        <div className="flex justify-between items-center mb-6 px-1 shrink-0">
            <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
            <Dialog open={isNewStageOpen} onOpenChange={setIsNewStageOpen}>
                <DialogTrigger asChild>
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Plus className="h-4 w-4 mr-2" /> {t('add_stage')}
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>{t('new_stage_modal')}</DialogTitle></DialogHeader>
                    <div className="flex gap-2 py-4">
                        <Popover>
                            <PopoverTrigger asChild><Button variant="outline" className="text-xl">{newStageEmoji}</Button></PopoverTrigger>
                            <PopoverContent className="w-full p-0 border-none"><EmojiPicker onEmojiClick={(e) => setNewStageEmoji(e.emoji)} /></PopoverContent>
                        </Popover>
                        <Input placeholder={t('stage_name_placeholder')} value={newStageName} onChange={(e) => setNewStageName(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateStage} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : t('create_btn')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>

        <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-x-auto overflow-y-hidden 
                       scrollbar-thin scrollbar-thumb-muted-foreground/50 scrollbar-track-transparent 
                       [&::-webkit-scrollbar]:h-3 
                       [&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 
                       [&::-webkit-scrollbar-thumb]:rounded-full 
                       [&::-webkit-scrollbar-track]:bg-transparent"
        >
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="board" direction="horizontal" type="COLUMN">
                    {(provided) => (
                        <div className="flex h-full gap-4 pb-4 min-w-max px-1" ref={provided.innerRef} {...provided.droppableProps}>
                            <div className="flex flex-col w-80 bg-muted/50 dark:bg-muted/20 rounded-xl border h-full max-h-full">
                                <div className="p-3 border-b bg-card/50 dark:bg-card/80 rounded-t-xl flex justify-between items-center sticky top-0 backdrop-blur-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">📍</span>
                                        <h3 className="font-semibold text-foreground text-sm uppercase">{t('unassigned')}</h3>
                                    </div>
                                    <Badge variant="secondary">{columns['unassigned']?.length || 0}</Badge>
                                </div>
                                <Droppable droppableId="unassigned" type="CARD">
                                    {(prov, snap) => (
                                        <div {...prov.droppableProps} ref={prov.innerRef} className={`flex-1 overflow-y-auto p-2 space-y-2 ${snap.isDraggingOver ? 'bg-primary/10' : ''}`}>
                                            {(columns['unassigned'] || []).map((card, idx) => (
                                                <CardItem key={card.id} card={card} index={idx} toggleAlert={handleToggleAlert} t={t} />
                                            ))}
                                            {prov.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>

                            {stages.map((stage, index) => (
                                <Draggable key={stage.id} draggableId={stage.id.toString()} index={index}>
                                    {(provided) => (
                                        <div ref={provided.innerRef} {...provided.draggableProps} className="flex flex-col w-80 bg-muted/50 dark:bg-muted/20 rounded-xl border h-full max-h-full">
                                            <div {...provided.dragHandleProps} className="p-3 border-b bg-card/50 dark:bg-card/80 rounded-t-xl flex justify-between items-center sticky top-0 backdrop-blur-sm group cursor-grab active:cursor-grabbing">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">{stage.emoji}</span>
                                                    <h3 className="font-semibold text-foreground text-sm uppercase">{stage.name}</h3>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary">{columns[stage.id]?.length || 0}</Badge>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-3 w-3" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => setEditingStage(stage)}><Pencil className="mr-2 h-3 w-3" /> {t('edit')}</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleDeleteStage(stage.id)} className="text-destructive"><Trash2 className="mr-2 h-3 w-3" /> {t('delete')}</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                            <Droppable droppableId={stage.id.toString()} type="CARD">
                                                {(prov, snap) => (
                                                    <div {...prov.droppableProps} ref={prov.innerRef} className={`flex-1 overflow-y-auto p-2 space-y-2 ${snap.isDraggingOver ? 'bg-primary/10' : ''}`}>
                                                        {(columns[stage.id] || []).map((card, idx) => (
                                                            <CardItem key={card.id} card={card} index={idx} toggleAlert={handleToggleAlert} t={t} />
                                                        ))}
                                                        {prov.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
        </div>

        <div className="absolute bottom-6 right-6 flex gap-2 z-10">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full shadow-md bg-background border-border hover:bg-muted" onClick={() => scrollBoard('left')}>
                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full shadow-md bg-background border-border hover:bg-muted" onClick={() => scrollBoard('right')}>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Button>
        </div>

        {editingStage && (
            <Dialog open={!!editingStage} onOpenChange={(o) => !o && setEditingStage(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{t('edit_stage_modal')}</DialogTitle></DialogHeader>
                    <div className="flex gap-2 py-4">
                        <Popover>
                            <PopoverTrigger asChild><Button variant="outline" className="text-xl">{editingStage.emoji}</Button></PopoverTrigger>
                            <PopoverContent className="w-full p-0 border-none"><EmojiPicker onEmojiClick={(e) => setEditingStage({...editingStage, emoji: e.emoji})} /></PopoverContent>
                        </Popover>
                        <Input value={editingStage.name} onChange={(e) => setEditingStage({...editingStage, name: e.target.value})} />
                    </div>
                    <DialogFooter>
                        <Button onClick={handleUpdateStage} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : t('save_btn')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}
    </div>
  );
}

function CardItem({ card, index, toggleAlert, t }: { card: ChatCard, index: number, toggleAlert: (c: ChatCard) => void, t: any }) {
    const router = useRouter();
    const daysInStage = getDaysInStage(card.updatedAt);
    
    const handleOpenChat = () => {
        const chatNumber = card.remoteJid.split('@')[0];
        const query = card.instanceId ? `?instanceId=${card.instanceId}` : '';
        router.push(`/dashboard/chat/${chatNumber}${query}`);
    };

    return (
        <Draggable key={card.id} draggableId={card.id.toString()} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`bg-card p-3 rounded-lg border shadow-sm group hover:shadow-md transition-all relative flex flex-col gap-2 ${snapshot.isDragging ? 'rotate-2 shadow-lg ring-2 ring-primary/20' : ''}`}
                    style={provided.draggableProps.style}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={card.profilePicUrl || ''} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs dark:bg-primary/20 dark:text-primary-foreground">
                                    {card.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-sm font-medium text-foreground line-clamp-1">{card.name}</p>
                                <p className="text-xs text-muted-foreground">{card.remoteJid.split('@')[0]}</p>
                            </div>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                                    <MoreHorizontal className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleOpenChat}>
                                    <MessageCircle className="mr-2 h-3 w-3" /> 
                                    {t('open_chat')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleAlert(card)}>
                                    <Clock className="mr-2 h-3 w-3" /> 
                                    {card.showTimeInStage ? t('hide_time') : t('view_time')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md min-h-[40px] flex items-center">
                        <span className="line-clamp-3 break-words" title={card.lastMessageText}>
                            {card.lastMessageText && !card.lastMessageText.startsWith('@@') ? card.lastMessageText : "..."}
                        </span>
                    </div>

                    <div className="flex justify-end items-center gap-2 mt-auto pt-1">
                        {card.showTimeInStage && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 font-normal">
                                <Clock className="w-3 h-3" /> {t('days', {count: daysInStage})}
                            </Badge>
                        )}
                        {card.unreadCount > 0 && (
                            <Badge className="bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700 text-[10px] h-5 px-1.5">
                                {card.unreadCount}
                            </Badge>
                        )}
                    </div>
                </div>
            )}
        </Draggable>
    );
}