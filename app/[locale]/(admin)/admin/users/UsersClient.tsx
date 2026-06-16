'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RoleSelector } from './role-selector';
import { UserActions } from './user-actions';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function UsersClient() {
  const t = useTranslations('AdminUsers');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [teamId, setTeamId] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceTimer) clearTimeout(debounceTimer);
      const timer = setTimeout(() => {
        setDebouncedSearch(value);
        setPage(1);
      }, 400);
      setDebounceTimer(timer);
    },
    [debounceTimer]
  );

  const params = new URLSearchParams();
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (role) params.set('role', role);
  if (teamId) params.set('teamId', teamId);
  params.set('page', String(page));

  const { data, isLoading } = useSWR(
    `/api/admin/users?${params.toString()}`,
    fetcher,
    { keepPreviousData: true }
  );

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const teams = data?.teams || [];

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setRole('');
    setTeamId('');
    setPage(1);
  };

  const hasFilters = debouncedSearch || role || teamId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Badge variant="outline">
          {total} {t('users_count')}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('all_users')}</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search_placeholder')}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={role}
              onValueChange={(v) => {
                setRole(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder={t('filter_role')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_roles')}</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={teamId}
              onValueChange={(v) => {
                setTeamId(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t('filter_team')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_teams')}</SelectItem>
                {teams.map((team: { id: number; name: string }) => (
                  <SelectItem key={team.id} value={String(team.id)}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters} title={t('clear_filters')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('col_name')}</TableHead>
                <TableHead>{t('col_email')}</TableHead>
                <TableHead>{t('col_team')}</TableHead>
                <TableHead>{t('col_role')}</TableHead>
                <TableHead>{t('col_joined')}</TableHead>
                <TableHead className="text-right">{t('col_actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t('no_users')}
                  </TableCell>
                </TableRow>
              ) : (
                users.map(
                  (user: {
                    id: number;
                    name: string | null;
                    email: string;
                    role: string;
                    createdAt: string;
                    teamName: string | null;
                  }) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.name || 'N/A'}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.teamName ? (
                          <Badge variant="outline">{user.teamName}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <RoleSelector userId={user.id} currentRole={user.role} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <UserActions userId={user.id} userName={user.name} />
                      </TableCell>
                    </TableRow>
                  )
                )
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                {t('page_info', { page, totalPages, total })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
