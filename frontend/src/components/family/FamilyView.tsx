import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Bell, Edit3, HeartPulse, Megaphone, Phone, Plus, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FridgeHubStore } from '@/hooks/useFridgeHub'
import { formatCompactDate } from '@/utils/date'

const colorOptions = [
  { value: 'bg-indigo-500', label: 'Indigo' },
  { value: 'bg-rose-500', label: 'Rose' },
  { value: 'bg-emerald-500', label: 'Green' },
  { value: 'bg-amber-500', label: 'Amber' },
  { value: 'bg-teal-500', label: 'Teal' },
  { value: 'bg-violet-500', label: 'Violet' },
  { value: 'bg-sky-500', label: 'Sky' },
  { value: 'bg-pink-500', label: 'Pink' },
]

export const FamilyView = ({ store }: { store: FridgeHubStore }) => {
  const { state, addAnnouncement, addMember, updateMember, deleteMember, deleteAnnouncement, addEmergencyContact, updateEmergencyContact, deleteEmergencyContact, markNotificationRead, loadNotificationPage, loadAuditLogs } = store
  const canManageFamily = store.can('manage_family')
  const canManageAnnouncements = store.can('manage_announcements')
  const canManageContacts = store.can('manage_contacts')
  const canViewAudit = store.can('view_audit')
  const notifications = store.paged.notifications ?? state.notifications
  const notificationPage = store.pagination.notifications
  const auditPage = store.pagination.auditLogs
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null)
  const [memberEdit, setMemberEdit] = useState({ name: '', role: '', colorClass: '', status: '' })
  const [memberDraft, setMemberDraft] = useState({ name: '', email: '', username: '', password: '', role: 'member', colorClass: 'bg-indigo-500' })
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactDraft, setContactDraft] = useState({ label: '', value: '' })
  const [editingContactId, setEditingContactId] = useState<number | null>(null)
  const [contactEdit, setContactEdit] = useState({ label: '', value: '' })

  useEffect(() => {
    loadNotificationPage(0)
  }, [loadNotificationPage])

  useEffect(() => {
    if (showAudit && canViewAudit) {
      loadAuditLogs(0)
    }
  }, [loadAuditLogs, canViewAudit, showAudit])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !message.trim()) return
    addAnnouncement(title.trim(), message.trim())
    setTitle('')
    setMessage('')
  }

  return (
    <div className="grid gap-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-500 px-6 py-8 text-white shadow-xl shadow-blue-400/20 sm:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/[0.06] blur-2xl animate-[moonFloat_7s_ease-in-out_infinite]" />
          <div className="absolute -bottom-20 -left-20 size-72 rounded-full bg-amber-300/[0.07] blur-3xl animate-[moonFloat_9s_ease-in-out_infinite_2s]" />
          <div className="absolute left-[18%] top-[22%] size-2 rounded-full bg-amber-200/70 animate-[starTwinkle_2s_ease-in-out_infinite]" />
          <div className="absolute left-[75%] top-[55%] size-1.5 rounded-full bg-white/50 animate-[starTwinkle_2.8s_ease-in-out_infinite_1s]" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-sm">
              <Users className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Family Workspace</h2>
              <p className="mt-0.5 text-sm text-blue-100">Members, announcements, contacts, and activity</p>
            </div>
          </div>
          <div className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm">
            {state.members.length} active members
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Family At A Glance</CardTitle>
                <p className="mt-1 text-xs text-slate-400">{state.family.homeBase} household</p>
              </div>
              <div className="flex items-center gap-2">
                {canManageFamily && (
                  <Button variant="outline" onClick={() => setShowAddMember(!showAddMember)}>
                    <UserPlus className="size-4" aria-hidden="true" />
                    Add member
                  </Button>
                )}
                <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-50">
                  <Users className="size-4 text-indigo-600" aria-hidden="true" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {canManageFamily && showAddMember && (
                <form
                  className="mb-5 grid gap-3 rounded-2xl border-2 border-indigo-100 bg-indigo-50/30 p-5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!memberDraft.name.trim() || !memberDraft.username.trim() || !memberDraft.email.trim() || !memberDraft.password.trim()) return
                    addMember(memberDraft)
                    setMemberDraft({ name: '', email: '', username: '', password: '', role: 'member', colorClass: 'bg-indigo-500' })
                    setShowAddMember(false)
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Full name">
                      <input className={inputClass} onChange={(e) => setMemberDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Ava Sharma" value={memberDraft.name} />
                    </FormField>
                    <FormField label="Username">
                      <input className={inputClass} onChange={(e) => setMemberDraft((d) => ({ ...d, username: e.target.value }))} placeholder="e.g. ava" value={memberDraft.username} />
                    </FormField>
                    <FormField label="Email">
                      <input className={inputClass} onChange={(e) => setMemberDraft((d) => ({ ...d, email: e.target.value }))} placeholder="e.g. ava@family.com" type="email" value={memberDraft.email} />
                    </FormField>
                    <FormField label="Password">
                      <input className={inputClass} onChange={(e) => setMemberDraft((d) => ({ ...d, password: e.target.value }))} placeholder="Min 8 characters" type="password" value={memberDraft.password} />
                    </FormField>
                    <FormField label="Role">
                      <select className={inputClass} onChange={(e) => setMemberDraft((d) => ({ ...d, role: e.target.value }))} value={memberDraft.role}>
                        <option value="member">Member</option>
                        <option value="Dad">Dad</option>
                        <option value="Mom">Mom</option>
                        <option value="Child">Child</option>
                      </select>
                    </FormField>
                    <FormField label="Color">
                      <select className={inputClass} onChange={(e) => setMemberDraft((d) => ({ ...d, colorClass: e.target.value }))} value={memberDraft.colorClass}>
                        {colorOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </FormField>
                  </div>
                  <Button type="submit">
                    <Plus className="size-4" aria-hidden="true" />
                    Add to family
                  </Button>
                </form>
              )}
              <div className="stagger-children grid gap-4 md:grid-cols-2">
                {state.members.map((member) => (
                  <article className="group rounded-2xl border border-slate-100/80 bg-slate-50/50 p-5 transition-all duration-200 hover:bg-white hover:shadow-md hover:border-slate-200" key={member.id}>
                    {editingMemberId === member.id ? (
                      <form
                        className="grid gap-3"
                        onSubmit={(e) => {
                          e.preventDefault()
                          updateMember(member.id, memberEdit)
                          setEditingMemberId(null)
                        }}
                      >
                        <FormField label="Name">
                          <input className={inputClass} value={memberEdit.name} onChange={(e) => setMemberEdit((d) => ({ ...d, name: e.target.value }))} />
                        </FormField>
                        <div className="grid grid-cols-2 gap-2">
                          <FormField label="Role">
                            <select className={inputClass} value={memberEdit.role} onChange={(e) => setMemberEdit((d) => ({ ...d, role: e.target.value }))}>
                              <option value="Mom">Mom</option>
                              <option value="Dad">Dad</option>
                              <option value="Child">Child</option>
                              <option value="member">Member</option>
                            </select>
                          </FormField>
                          <FormField label="Color">
                            <select className={inputClass} value={memberEdit.colorClass} onChange={(e) => setMemberEdit((d) => ({ ...d, colorClass: e.target.value }))}>
                              {colorOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                          </FormField>
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit">Save</Button>
                          <Button variant="secondary" onClick={() => setEditingMemberId(null)} type="button">Cancel</Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-start gap-3.5">
                        <Avatar className="size-12" colorClass={member.colorClass} initial={member.initial} label={member.name} />
                        <div className="min-w-0 flex-1">
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
                          {canManageFamily && (
                            <div className="mt-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                                onClick={() => { setEditingMemberId(member.id); setMemberEdit({ name: member.name, role: member.role, colorClass: member.colorClass, status: member.status }) }}
                                type="button"
                              >
                                <Edit3 className="size-3" aria-hidden="true" /> Edit
                              </button>
                              <button
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50"
                                onClick={() => { if (window.confirm(`Remove ${member.name} from the family?`)) deleteMember(member.id) }}
                                type="button"
                              >
                                <Trash2 className="size-3" aria-hidden="true" /> Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">{announcement.title}</h3>
                          <Badge tone="slate">{announcement.tag}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{announcement.message}</p>
                        <p className="mt-2 text-[11px] text-slate-400">
                          {owner?.name ?? 'Family'} - {formatCompactDate(announcement.createdAt.slice(0, 10))}
                        </p>
                      </div>
                      {canManageAnnouncements && (
                        <button
                          className="flex size-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                          onClick={() => { if (window.confirm('Delete this announcement?')) deleteAnnouncement(announcement.id) }}
                          title="Delete announcement"
                          type="button"
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      )}
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
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Emergency Contacts</CardTitle>
              {canManageContacts && (
                <Button variant="secondary" onClick={() => setShowAddContact(!showAddContact)}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid gap-2.5">
              {canManageContacts && showAddContact && (
                <form
                  className="grid gap-2 rounded-xl border border-indigo-100 bg-indigo-50/30 p-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!contactDraft.label.trim() || !contactDraft.value.trim()) return
                    addEmergencyContact(contactDraft.label.trim(), contactDraft.value.trim())
                    setContactDraft({ label: '', value: '' })
                    setShowAddContact(false)
                  }}
                >
                  <input className={inputClass} placeholder="Label (e.g. Doctor)" value={contactDraft.label} onChange={(e) => setContactDraft((d) => ({ ...d, label: e.target.value }))} />
                  <input className={inputClass} placeholder="Number (e.g. 6123 4567)" value={contactDraft.value} onChange={(e) => setContactDraft((d) => ({ ...d, value: e.target.value }))} />
                  <Button type="submit"><Plus className="size-4" aria-hidden="true" /> Add contact</Button>
                </form>
              )}
              {state.emergencyContacts.map((contact) => (
                <div className="flex items-center justify-between rounded-xl border border-rose-100/60 bg-rose-50/50 p-4 transition-all duration-200 hover:bg-rose-50" key={contact.id}>
                  {editingContactId === contact.id ? (
                    <form
                      className="flex flex-1 items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        updateEmergencyContact(contact.id, contactEdit)
                        setEditingContactId(null)
                      }}
                    >
                      <input className={inputClass} value={contactEdit.label} onChange={(e) => setContactEdit((d) => ({ ...d, label: e.target.value }))} />
                      <input className={inputClass} value={contactEdit.value} onChange={(e) => setContactEdit((d) => ({ ...d, value: e.target.value }))} />
                      <Button type="submit">Save</Button>
                      <Button variant="secondary" onClick={() => setEditingContactId(null)} type="button">Cancel</Button>
                    </form>
                  ) : (
                    <>
                      <span className="flex items-center gap-2 text-sm font-semibold text-rose-800">
                        <Phone className="size-4" aria-hidden="true" />
                        {contact.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-700">{contact.value}</span>
                        {canManageContacts && (
                          <>
                            <button
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-indigo-600"
                              onClick={() => { setEditingContactId(contact.id); setContactEdit({ label: contact.label, value: contact.value }) }}
                              title="Edit" type="button"
                            >
                              <Edit3 className="size-3.5" aria-hidden="true" />
                            </button>
                            <button
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              onClick={() => { if (window.confirm(`Remove ${contact.label}?`)) deleteEmergencyContact(contact.id) }}
                              title="Delete" type="button"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
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
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>Audit History</CardTitle>
                  <p className="mt-1 text-xs text-slate-400">Security and household changes</p>
                </div>
                <Button variant="secondary" onClick={() => setShowAudit(!showAudit)}>
                  {showAudit ? 'Hide' : 'Show'}
                </Button>
              </CardHeader>
              {showAudit && (
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
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
