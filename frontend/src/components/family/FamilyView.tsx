import { useState } from 'react'
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
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!title.trim() || !message.trim()) {
      return
    }

    addAnnouncement(title.trim(), message.trim())
    setTitle('')
    setMessage('')
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Family Workspace</h2>
          <p className="mt-1 text-sm text-slate-500">Members, announcements, contacts, and household activity</p>
        </div>
        <Badge tone="green">{state.members.length} active members</Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Family At A Glance</CardTitle>
                <p className="mt-1 text-sm text-slate-500">{state.family.homeBase} household profile</p>
              </div>
              <Users className="size-5 text-blue-600" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {state.members.map((member) => (
                  <article className="rounded-lg border border-slate-100 bg-slate-50 p-4" key={member.id}>
                    <div className="flex items-start gap-3">
                      <Avatar className="size-12" colorClass={member.colorClass} initial={member.initial} label={member.name} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-950">{member.name}</h3>
                          <Badge tone="blue">{member.role}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{member.status}</p>
                        <p className="mt-3 text-sm font-semibold text-slate-800">{member.points} reward points</p>
                        {member.dietaryNotes && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {member.dietaryNotes.map((note) => (
                              <Badge key={note} tone="teal">
                                {note}
                              </Badge>
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
              <p className="mt-1 text-sm text-slate-500">Shared messages and planning notes</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {state.announcements.map((announcement) => {
                const owner = state.members.find((member) => member.id === announcement.ownerId)

                return (
                  <article className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm" key={announcement.id}>
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Megaphone className="size-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-950">{announcement.title}</h3>
                          <Badge tone="slate">{announcement.tag}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{announcement.message}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          {owner?.name ?? 'Family'} - {formatCompactDate(announcement.createdAt.slice(0, 10))}
                        </p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </CardContent>
          </Card>
        </div>

        <aside className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>New Announcement</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={handleSubmit}>
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
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Emergency Contacts</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {state.emergencyContacts.map((contact) => (
                <div className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50 p-3" key={contact.id}>
                  <span className="flex items-center gap-2 font-semibold text-rose-950">
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
              <CardTitle>Health and Safety</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-lg bg-emerald-50 p-4">
                <HeartPulse className="mb-3 size-5 text-emerald-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-emerald-950">Medication reminder active</p>
                <p className="mt-1 text-sm text-emerald-700">Dad has a daily 8:00 AM reminder.</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-4">
                <ShieldCheck className="mb-3 size-5 text-blue-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-blue-950">Family role access</p>
                <p className="mt-1 text-sm text-blue-700">Parent-owned records are ready for API authorization.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Log</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {state.notifications.map((notification) => (
                <button
                  className="grid gap-1 rounded-lg border border-slate-100 bg-white p-3 text-left shadow-sm transition hover:bg-slate-50"
                  key={notification.id}
                  onClick={() => markNotificationRead(notification.id)}
                  type="button"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <Bell className="size-4 text-blue-600" aria-hidden="true" />
                    {notification.title}
                  </span>
                  <span className="text-xs leading-5 text-slate-500">{notification.message}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
