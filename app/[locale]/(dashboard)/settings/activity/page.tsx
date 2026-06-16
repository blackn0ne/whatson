import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Settings,
  LogOut,
  UserPlus,
  Lock,
  UserCog,
  AlertCircle,
  UserMinus,
  Mail,
  CheckCircle,
  Smartphone,
  Layers,
  Tag,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { ActivityType } from '@/lib/db/schema';
import { getActivityLogs } from '@/lib/db/queries';
import { getTranslations } from 'next-intl/server'; 

const iconMap: Record<ActivityType, LucideIcon> = {
  [ActivityType.SIGN_UP]: UserPlus,
  [ActivityType.SIGN_IN]: UserCog,
  [ActivityType.SIGN_OUT]: LogOut,
  [ActivityType.UPDATE_PASSWORD]: Lock,
  [ActivityType.DELETE_ACCOUNT]: UserMinus,
  [ActivityType.UPDATE_ACCOUNT]: Settings,
  [ActivityType.CREATE_TEAM]: UserPlus,
  [ActivityType.REMOVE_TEAM_MEMBER]: UserMinus,
  [ActivityType.INVITE_TEAM_MEMBER]: Mail,
  [ActivityType.ACCEPT_INVITATION]: CheckCircle,
  [ActivityType.CREATE_INSTANCE]: Smartphone,
  [ActivityType.DELETE_INSTANCE]: Smartphone,
  [ActivityType.LOGOUT_INSTANCE]: Smartphone,
  [ActivityType.CREATE_CONTACT]: UserPlus,
  [ActivityType.ASSIGN_AGENT]: UserCheck,
  [ActivityType.ASSIGN_DEPARTMENT]: UserCheck,
  [ActivityType.CHANGE_FUNNEL_STAGE]: Layers,
  [ActivityType.ADD_TAG]: Tag,
  [ActivityType.REMOVE_TAG]: Tag,
};


function getRelativeTime(date: Date, t: any) {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return t('time_just_now');
  if (diffInSeconds < 3600)
    return t('time_minutes_ago', { count: Math.floor(diffInSeconds / 60) });
  if (diffInSeconds < 86400)
    return t('time_hours_ago', { count: Math.floor(diffInSeconds / 3600) });
  if (diffInSeconds < 604800)
    return t('time_days_ago', { count: Math.floor(diffInSeconds / 86400) });
  return date.toLocaleDateString('en-US'); 
}

function formatAction(action: ActivityType, t: any): string {
  switch (action) {
    case ActivityType.SIGN_UP:
      return t('action_signed_up');
    case ActivityType.SIGN_IN:
      return t('action_signed_in');
    case ActivityType.SIGN_OUT:
      return t('action_signed_out');
    case ActivityType.UPDATE_PASSWORD:
      return t('action_changed_password');
    case ActivityType.DELETE_ACCOUNT:
      return t('action_deleted_account');
    case ActivityType.UPDATE_ACCOUNT:
      return t('action_updated_account');
    case ActivityType.CREATE_TEAM:
      return t('action_created_team');
    case ActivityType.REMOVE_TEAM_MEMBER:
      return t('action_removed_team_member');
    case ActivityType.INVITE_TEAM_MEMBER:
      return t('action_invited_team_member');
    case ActivityType.ACCEPT_INVITATION:
      return t('action_accepted_invitation');
    case ActivityType.CREATE_INSTANCE:
      return t('action_connected_whatsapp_instance');
    case ActivityType.DELETE_INSTANCE:
      return t('action_removed_whatsapp_instance');
    case ActivityType.LOGOUT_INSTANCE:
      return t('action_disconnected_instance');
    case ActivityType.CREATE_CONTACT:
      return t('action_saved_contact');
    case ActivityType.ASSIGN_AGENT:
      return t('action_assigned_chat_to_agent');
    case ActivityType.CHANGE_FUNNEL_STAGE:
      return t('action_moved_contact_funnel_stage');
    case ActivityType.ADD_TAG:
      return t('action_added_tag_to_contact');
    case ActivityType.REMOVE_TAG:
      return t('action_removed_tag_from_contact');
    default:
      return t('action_unknown');
  }
}

export default async function ActivityPage() {
  
  const t = await getTranslations('Settings'); 
  const logs = await getActivityLogs();

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-foreground mb-6">
        {t('activity_log_title')}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('recent_activity_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <ul className="space-y-4">
              {logs.map((log) => {
                const Icon = iconMap[log.action as ActivityType] || Settings;
                const formattedAction = formatAction(
                  log.action as ActivityType, t
                );

                return (
                  <li key={log.id} className="flex items-center space-x-4">
                    <div className="bg-primary/10 rounded-full p-2">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {formattedAction}
                        {log.ipAddress && t('from_ip', { ipAddress: log.ipAddress })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getRelativeTime(new Date(log.timestamp), t)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <AlertCircle className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t('no_activity_yet_title')}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {t('no_activity_yet_desc')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}