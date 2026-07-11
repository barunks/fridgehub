import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Bell, HeartPulse, Megaphone, Phone, ShieldCheck, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import { formatCompactDate } from '@/utils/date'

export const FamilyView = ({ store }: { store: FamilyHubStore }) => {
  const { state, addAnnouncement, markNotificationRead } = store
  const canManageAnnouncements = store.can('manage_announcements')
  const canViewAudit = store.can('view_audit')
  const notifications = store.paged.notifications ?? state.notifications
  const notificationPage = store.pagination.notifications
  const auditPage = store.pagination.auditLogs
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    store.loadNotificationPage(0)
  }, [store])

  useEffect(() => {
    if (canViewAudit) {
      store.loadAuditLogs(0)
    }
  }, [store, canViewAudit])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !message.trim()) return
    addAnnouncement(title.trim(), message.trim())
    setTitle('')
    setMessage('')
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Family Workspace</h2>
          <p className="mt-1 text-sm text-slate-400">Members, announcements, contacts, and activity</p>
        </div>
        <Badge tone="green">{state.members.length} active members</Badge>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Family At A Glance</CardTitle>
                <p className="mt-1 text-xs text-slate-400">{state.family.homeBase} household</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-50">
                <Users className="size-4 text-indigo-600" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {state.members.map((member) => (
                  <article className="group rounded-2xl border border-slate-100/80 bg-slate-50/50 p-5 transition-all duration-200 hover:bg-white hover:shadow-md hover:border-slate-200" key={member.id}>
                    <div className="flex items-start gap-3.5">
                      <Avatar className="size-12" colorClass={member.colorClass} initial={member.initial} label={member.name} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{member.name}</h3>
                          <Badge tone="indigo">{member.role}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{member.status}</p>
                        <p className="mt-3 text-sm font-semibold text-slate-700">⭐ {member.points} points</p>
                        {member.dietaryNotes && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {member.dietaryNotes.map((note) => (
                              <Badge key={note} tone="teal">{note}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Announcements</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Shared messages and planning notes</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {state.announcements.map((announcement) => {
                const owner = state.members.find((member) => member.id === announcement.ownerId)
                return (
                  <article className="rounded-xl border border-slate-100/80 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md" key={announcement.id}>
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Megaphone className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">{announcement.title}</h3>
                          <Badge tone="slate">{announcement.tag}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{announcement.message}</p>
                        <p className="mt-2 text-[11px] text-slate-400">
                          {owner?.name ?? 'Family'} · {formatCompactDate(announcement.createdAt.slice(0, 10))}
                        </p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </CardContent>
          </Card>
        </div>

        <aside className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>New Announcement</CardTitle>
            </CardHeader>
              <CardContent>
                <form className="grid gap-3.5" onSubmit={handleSubmit}>
                  <fieldset className="m-0 grid gap-3.5 border-0 p-0" disabled={!canManageAnnouncements}>
                  <FormField label="Title">
                  <input className={inputClass} onChange={(event) => setTitle(event.target.value)} value={title} />
                </FormField>
                <FormField label="Message">
                  <textarea
                    className={`${inputClass} min-h-24 resize-none`}
                    onChange={(event) => setMessage(event.target.value)}
                    value={message}
                  />
                </FormField>
                  <Button type="submit">
                    <Megaphone className="size-4" aria-hidden="true" />
                    Publish
                  </Button>
                  </fieldset>
                </form>
              </CardContent>
            </Card>

          <Card>
            <CardHeader>
              <CardTitle>Emergency Contacts</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5">
              {state.emergencyContacts.map((contact) => (
                <div className="flex items-center justify-between rounded-xl border border-rose-100/60 bg-rose-50/50 p-4 transition-all duration-200 hover:bg-rose-50" key={contact.id}>
                  <span className="flex items-center gap-2 text-sm font-semibold text-rose-800">
                    <Phone className="size-4" aria-hidden="true" />
                    {contact.label}
                  </span>
                  <span className="font-bold text-rose-700">{contact.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Health & Safety</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-xl bg-emerald-50/80 p-4">
                <HeartPulse className="mb-2.5 size-5 text-emerald-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">Medication reminder active</p>
                <p className="mt-1 text-xs text-slate-500">Dad has a daily 8:00 AM reminder.</p>
              </div>
              <div className="rounded-xl bg-indigo-50/80 p-4">
                <ShieldCheck className="mb-2.5 size-5 text-indigo-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">Family role access</p>
                <p className="mt-1 text-xs text-slate-500">Parent-owned records are protected by RBAC.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Log</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5">
              {notifications.map((notification) => (
                <button
                  className="grid gap-1.5 rounded-xl border border-slate-100/80 bg-white p-3.5 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-200"
                  key={notification.id}
                  onClick={() => markNotificationRead(notification.id)}
                  type="button"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Bell className="size-3.5 text-indigo-500" aria-hidden="true" />
                    {notification.title}
                  </span>
                  <span className="text-[11px] leading-5 text-slate-400">{notification.message}</span>
                </button>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-500">
                  Page {Math.floor(notificationPage.offset / notificationPage.limit) + 1} - {notifications.length} loaded
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    disabled={notificationPage.offset === 0 || notificationPage.isLoading}
                    onClick={() => store.loadNotificationPage(notificationPage.offset - notificationPage.limit)}
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={!notificationPage.hasNext || notificationPage.isLoading}
                    onClick={() => store.loadNotificationPage(notificationPage.offset + notificationPage.limit)}
                    variant="secondary"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {canViewAudit && (
            <Card>
              <CardHeader>
                <CardTitle>Audit History</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Security and household changes recorded by the backend</p>
              </CardHeader>
              <CardContent className="grid gap-2.5">
                {store.auditLogs.length === 0 ? (
                  <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">No audit entries loaded.</p>
                ) : (
                  store.auditLogs.map((entry) => (
                    <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm" key={entry.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{entry.action || 'event'}</p>
                        <Badge tone="slate">{entry.entityType || 'system'}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {entry.entityId ? `#${entry.entityId} - ` : ''}
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                      {entry.changes && Object.keys(entry.changes).length > 0 && (
                        <pre className="mt-2 max-h-28 overflow-auto rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500">
                          {JSON.stringify(entry.changes, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-slate-500">
                    Page {Math.floor(auditPage.offset / auditPage.limit) + 1} - {store.auditLogs.length} loaded
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={auditPage.offset === 0 || auditPage.isLoading}
                      onClick={() => store.loadAuditLogs(auditPage.offset - auditPage.limit)}
                      variant="secondary"
                    >
                      Previous
                    </Button>
                    <Button
                      disabled={!auditPage.hasNext || auditPage.isLoading}
                      onClick={() => store.loadAuditLogs(auditPage.offset + auditPage.limit)}
                      variant="secondary"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
