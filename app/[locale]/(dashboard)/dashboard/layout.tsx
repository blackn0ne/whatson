'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { getTeamChannel } from '@/lib/pusher-client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  PlusCircle,
  MoreVertical,
  XCircle,
  Trash2,
  X,
  Bell,
  BellRing,
  BellOff,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

import { ChatListItem, ChatListSkeleton, Chat, Agent, FunnelStage, TagData } from '@/components/dashboard/ChatListItem';
import { TeamDataWithMembers } from '@/lib/db/schema';
import { ChatFilters } from '@/components/dashboard/ChatFilters';
import { NewChatDialog } from '@/components/dashboard/NewChatDialog';

type InstanceData = {
    dbId: number;
    instanceName: string;
    integration: 'WHATSAPP-BAILEYS' | 'WHATSAPP-BUSINESS';
};

type TeamData = { id: number; };

type ChatListUpdatePayload = Partial<Omit<Chat, 'id' | 'teamId'>> & {
  remoteJid: string;
  id?: number;
};

type FilterState = {
  funnelStageId: number | null;
  tagId: number | null;
  agentId: number | null;
  instanceId: number | null;
};

type SystemAlertData = {
  type: 'permission' | 'warning' | 'info';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const SOUNDS = [
  { id: 'sound1', name: 'Pop', src: '/sounds/notification_1.mp3' },
  { id: 'sound2', name: 'Ding', src: '/sounds/notification_2.mp3' },
  { id: 'sound3', name: 'Chime', src: '/sounds/notification_3.mp3' },
  { id: 'sound4', name: 'Ping', src: '/sounds/notification_4.mp3' },
  { id: 'sound5', name: 'Glass', src: '/sounds/notification_5.mp3' },
];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const activeChatNumber = pathname.split('/chat/')[1] || null;
  const activeInstanceId = searchParams.get('instanceId');

  const parentRef = useRef<HTMLElement | null>(null);
  const { mutate } = useSWRConfig();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [detailedFilters, setDetailedFilters] = useState<FilterState>({
    funnelStageId: null,
    tagId: null,
    agentId: null,
    instanceId: null,
  });

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState<Set<number>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedSound, setSelectedSound] = useState('sound1');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [mutedChats, setMutedChats] = useState<Set<string>>(new Set());
  const mutedChatsRef = useRef<Set<string>>(mutedChats);
  mutedChatsRef.current = mutedChats;
  const [systemAlert, setSystemAlert] = useState<SystemAlertData | null>(null);

  const { data: teamData } = useSWR<TeamData>('/api/team', fetcher);
  const teamId = teamData?.id;

  const { data: chats, error, isLoading, mutate: mutateChats } = useSWR<Chat[]>('/api/chats', fetcher);

  const { data: instances } = useSWR<InstanceData[]>('/api/instance/details', fetcher);

  const { data: teamMembers } = useSWR<TeamDataWithMembers>('/api/team', fetcher);
  const contextAgents: Agent[] = teamMembers?.teamMembers?.map(tm => tm.user) || [];
  const { data: contextFunnelStages } = useSWR<FunnelStage[]>('/api/funnel-stages', fetcher);
  const { data: contextTags } = useSWR<TagData[]>('/api/tags', fetcher);

  useEffect(() => {
    const storedSoundEnabled = localStorage.getItem('soundEnabled');
    const storedSelectedSound = localStorage.getItem('selectedSound');
    
    if (storedSoundEnabled !== null) setSoundEnabled(storedSoundEnabled === 'true');
    if (storedSelectedSound) setSelectedSound(storedSelectedSound);

    const storedMutedChats = localStorage.getItem('mutedChats');
    if (storedMutedChats) {
      try { setMutedChats(new Set(JSON.parse(storedMutedChats))); } catch {}
    }

    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (notificationPermission === 'default' || notificationPermission === 'denied') {
      setSystemAlert({
        type: 'permission',
        message: 'Enable desktop notifications to receive message alerts.',
        actionLabel: 'Enable',
        onAction: requestNotificationPermission
      });
    } else {
      setSystemAlert(prev => prev?.type === 'permission' ? null : prev);
    }
  }, [notificationPermission]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        toast.error("Browser does not support notifications");
        return;
    }
    
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    
    if (permission === 'granted') {
      setSystemAlert(null);
      new Notification("Notifications Enabled", { body: "You will now receive alerts for new messages." });
    } else if (permission === 'denied') {
      toast.error("Permission denied. Please enable in browser settings.");
    }
  };

  const playNotificationSoundRef = useRef<() => void>(() => {});
  const playNotificationSound = (soundId?: string) => {
    if (!soundEnabled && !soundId) return;
    
    const idToPlay = soundId || selectedSound;
    const soundData = SOUNDS.find(s => s.id === idToPlay);
    
    if (soundData) {
      try {
        const audio = new Audio(soundData.src);
        audio.volume = 0.5;
        audio.currentTime = 0;
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("Audio playback error:", error);
                if (error.name === 'NotSupportedError') {
                    toast.error("Audio format not supported or file not found.");
                }
            });
        }
      } catch (e) {
        console.error("Failed to initialize audio:", e);
      }
    }
  };
  playNotificationSoundRef.current = playNotificationSound;

  useEffect(() => {
    if (!teamId) return;

    const channel = getTeamChannel(teamId);
    if (!channel) return;

    const sortChats = (chatList: Chat[]) => {
      return [...chatList].sort((a, b) => {
        const timeA = a.lastMessageTimestamp ? new Date(a.lastMessageTimestamp).getTime() : 0;
        const timeB = b.lastMessageTimestamp ? new Date(b.lastMessageTimestamp).getTime() : 0;
        return timeB - timeA;
      });
    };

    const handleChatListUpdate = (updateData: ChatListUpdatePayload) => {
      if (updateData.lastMessageFromMe === false && !mutedChatsRef.current.has(updateData.remoteJid)) {
        playNotificationSoundRef.current();
      }

      mutate('/api/chats', async (currentChats: Chat[] | undefined = []) => {
        const chatsList = currentChats || [];

        const existingIndex = chatsList.findIndex(c => {
          if (updateData.id && c.id === updateData.id) return true;
          return c.remoteJid === updateData.remoteJid && (!updateData.instanceId || c.instanceId === updateData.instanceId);
        });

        let updatedList;

        if (existingIndex > -1) {
          const updatedChat = { ...chatsList[existingIndex], ...updateData };
          updatedList = [...chatsList];
          updatedList[existingIndex] = updatedChat as Chat;
        } else {
          const newChat = {
            id: updateData.id || Date.now(),
            teamId: teamId,
            name: updateData.remoteJid.split('@')[0],
            unreadCount: 1,
            ...updateData
          } as Chat;
          updatedList = [newChat, ...chatsList];
        }

        return sortChats(updatedList);
      }, { revalidate: false });
    };

    const handleNewMessage = (payload: any) => {
      if (!payload?.fromMe && !mutedChatsRef.current.has(payload?.remoteJid)) {
        playNotificationSoundRef.current();
      }
      mutate('/api/chats');
    };

    channel.bind('chat-list-update', handleChatListUpdate);
    channel.bind('new-message', handleNewMessage);

    return () => {
      channel.unbind('chat-list-update', handleChatListUpdate);
      channel.unbind('new-message', handleNewMessage);
    };
  }, [teamId, mutate]);

  const validChats = useMemo(() => {
    if (!chats || !Array.isArray(chats)) return [];

    return chats.filter((chat) => {
      if (!chat.remoteJid) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = chat.name?.toLowerCase().includes(query);
        const matchPushName = chat.pushName?.toLowerCase().includes(query);
        const matchPhone = chat.remoteJid.includes(query);
        const matchContactName = chat.contact?.name?.toLowerCase().includes(query);

        if (!matchName && !matchPushName && !matchPhone && !matchContactName) return false;
      }

      if (activeTab === 'unread') {
        if (!chat.unreadCount || chat.unreadCount === 0) return false;
      }

      if (detailedFilters.funnelStageId) {
        if (chat.contact?.funnelStage?.id !== detailedFilters.funnelStageId) return false;
      }

      if (detailedFilters.agentId) {
        if (chat.contact?.assignedUser?.id !== detailedFilters.agentId) return false;
      }

      if (detailedFilters.tagId) {
        const hasTag = chat.contact?.tags?.some(t => t.id === detailedFilters.tagId);
        if (!hasTag) return false;
      }

      if (detailedFilters.instanceId) {
        if (chat.instanceId !== detailedFilters.instanceId) return false;
      }

      return true;
    });
  }, [chats, searchQuery, activeTab, detailedFilters]);

  const rowVirtualizer = useVirtualizer({
    count: validChats.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const chat = validChats[index];
      return chat?.contact?.funnelStage ? 105 : 82;
    },
    measureElement: (element) => (element as HTMLElement).offsetHeight,
    overscan: 5,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [validChats]);

  const handleSelectChat = (chatId: number) => {
    const newSelected = new Set(selectedChats);
    if (newSelected.has(chatId)) {
      newSelected.delete(chatId);
    } else {
      newSelected.add(chatId);
    }
    setSelectedChats(newSelected);
    
    if (!isSelectionMode && newSelected.size > 0) {
        setIsSelectionMode(true);
    }
  };

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedChats(new Set());
      setIsSelectionMode(false);
    } else {
      setIsSelectionMode(true);
    }
  };

  const handleDeleteChats = async () => {
    setIsDeleting(true);
    const previousChats = chats;

    mutate(
        '/api/chats',
        (currentChats: Chat[] | undefined = []) => {
            return currentChats.filter(chat => !selectedChats.has(chat.id));
        },
        { revalidate: false }
    );

    try {
      const response = await fetch('/api/chats/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatIds: Array.from(selectedChats) }),
      });

      if (!response.ok) throw new Error('Failed to delete chats');

      toast.success('Chats deleted successfully');
      
      const currentChat = Array.isArray(chats) ? chats.find(c => c.remoteJid.includes(activeChatNumber || '')) : undefined;
      if (currentChat && selectedChats.has(currentChat.id)) {
        router.push('/dashboard');
      }

      setSelectedChats(new Set());
      setIsSelectionMode(false);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Error deleting chats');
      mutate('/api/chats', previousChats, { revalidate: true });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSoundToggle = (checked: boolean) => {
    setSoundEnabled(checked);
    localStorage.setItem('soundEnabled', String(checked));
  };

  const handleSoundChange = (value: string) => {
    setSelectedSound(value);
    localStorage.setItem('selectedSound', value);
    playNotificationSound(value);
  };

  const handleToggleMuteChat = (remoteJid: string) => {
    setMutedChats(prev => {
      const next = new Set(prev);
      if (next.has(remoteJid)) {
        next.delete(remoteJid);
      } else {
        next.add(remoteJid);
      }
      localStorage.setItem('mutedChats', JSON.stringify([...next]));
      return next;
    });
  };

  const renderChatList = () => {
    if (isLoading) return <ChatListSkeleton />;
    if (error) return <div className="p-4 text-center text-destructive text-sm">Error loading chats.</div>;
    if (!validChats || validChats.length === 0) {
      if (searchQuery || activeTab === 'unread' || detailedFilters.funnelStageId || detailedFilters.instanceId) {
        return <div className="p-8 text-center text-muted-foreground text-sm">No chats found.</div>;
      }
      return <div className="p-8 text-center text-muted-foreground text-sm">No chats started.</div>;
    }

    return (
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const chat = validChats[virtualItem.index];
          if (!chat) return null;
          const isGroupChat = chat.remoteJid.endsWith('@g.us');
          const chatIdentifier = isGroupChat ? chat.remoteJid : chat.remoteJid.split('@')[0];
          const decodedActiveChatNumber = activeChatNumber ? decodeURIComponent(activeChatNumber) : null;

          const isActive = chatIdentifier === decodedActiveChatNumber &&
                           (!activeInstanceId || chat.instanceId === parseInt(activeInstanceId));

          return (
            <div
              key={chat.id}
              data-index={virtualItem.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                transition: 'transform 300ms ease-out',
              }}
            >
              <ChatListItem
                chat={chat}
                isActive={isActive}
                instances={instances || []}
                isSelectionMode={isSelectionMode}
                isSelected={selectedChats.has(chat.id)}
                onSelect={handleSelectChat}
                agents={contextAgents}
                funnelStages={contextFunnelStages || []}
                tags={contextTags || []}
                onContactUpdate={(updater) => {
                  if (updater) {
                    mutateChats((current) => updater(current || []), { revalidate: false });
                    setTimeout(() => rowVirtualizer.measure(), 50);
                  } else {
                    mutateChats();
                  }
                }}
                isMuted={mutedChats.has(chat.remoteJid)}
                onToggleMute={() => handleToggleMuteChat(chat.remoteJid)}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-muted/40 dark:bg-background">
      <aside className="w-full max-w-md flex flex-col bg-card border-r md:w-[35%] lg:w-[28%]">
        <header className="flex items-center justify-between px-4 py-2 border-b h-[60px]">
          <div className="flex items-center gap-2">
            {isSelectionMode ? (
                <div className="flex items-center gap-2 animate-in slide-in-from-left-2 fade-in duration-200">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={toggleSelectionMode}>
                        <X className="h-5 w-5" />
                    </Button>
                    <span className="text-sm font-medium text-primary">{selectedChats.size} selected</span>
                </div>
            ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-muted relative">
                        {notificationPermission === 'granted' && soundEnabled ? (
                            <Bell className="h-5 w-5" />
                        ) : (
                            <BellOff className="h-5 w-5 text-muted-foreground/70" />
                        )}
                        {notificationPermission !== 'granted' && (
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive border border-card" />
                        )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64" align="start">
                    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {notificationPermission !== 'granted' && (
                        <>
                            <DropdownMenuItem onClick={requestNotificationPermission} className="text-destructive focus:text-destructive cursor-pointer">
                                <BellRing className="mr-2 h-4 w-4" />
                                Allow Notifications
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}

                    <DropdownMenuCheckboxItem 
                        checked={soundEnabled} 
                        onCheckedChange={handleSoundToggle}
                    >
                        Enable Sound
                    </DropdownMenuCheckboxItem>
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Alert Tone</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={selectedSound} onValueChange={handleSoundChange}>
                        {SOUNDS.map(sound => (
                            <DropdownMenuRadioItem key={sound.id} value={sound.id} className="cursor-pointer">
                                {sound.name}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            {isSelectionMode ? (
               <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 text-destructive hover:bg-destructive/10"
                  disabled={selectedChats.size === 0}
                  onClick={() => setIsDeleteDialogOpen(true)}
               >
                  <Trash2 className="h-5 w-5" />
               </Button>
            ) : (
               <>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => setIsNewChatOpen(true)}>
                  <PlusCircle className="h-5 w-5" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-1" align="end">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-sm h-8 px-2"
                      onClick={toggleSelectionMode}
                    >
                      Select Chats
                    </Button>
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </header>

        {systemAlert && (
            <div className={`
                flex items-center justify-between px-4 py-3 mx-4 mt-4 rounded-lg shadow-sm text-sm animate-in fade-in slide-in-from-top-2
                ${systemAlert.type === 'permission' ? 'bg-emerald-900/90 text-white' : systemAlert.type === 'warning' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-blue-100 text-blue-900 border border-blue-200'}
            `}>
                <div className="flex items-center gap-2 overflow-hidden">
                    {systemAlert.type === 'permission' ? <BellOff className="h-4 w-4 shrink-0" /> : <Info className="h-4 w-4 shrink-0" />}
                    <span className="font-medium truncate">{systemAlert.message}</span>
                </div>
                <div className="flex items-center shrink-0">
                    {systemAlert.actionLabel && systemAlert.onAction && (
                        <button 
                            onClick={systemAlert.onAction}
                            className="font-bold underline ml-3 whitespace-nowrap text-xs uppercase hover:opacity-80"
                        >
                            {systemAlert.actionLabel}
                        </button>
                    )}
                    <button onClick={() => setSystemAlert(null)} className="ml-3 hover:opacity-70">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        )}

        <div className="p-4 border-b border-border bg-muted/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-10 bg-background border-border rounded-lg h-11 focus-visible:ring-ring"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <ChatFilters
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          filters={detailedFilters}
          setFilters={setDetailedFilters}
          instances={instances || []}
        />

        <nav ref={parentRef} className="flex-1 overflow-y-auto relative bg-background pt-2">
          {renderChatList()}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">{children}</main>

      <NewChatDialog 
        isOpen={isNewChatOpen} 
        onClose={() => setIsNewChatOpen(false)} 
        instances={instances || []} 
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chats?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete {selectedChats.size} chat(s) and their history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteChats} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}