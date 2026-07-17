import { useCallback, useEffect, useState } from 'react'
import { Key, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { api } from '@/services/api'
import type { DeviceInfo } from '@/types/familyHub'
import { cn } from '@/utils/style'

export const DeviceManagement = () => {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [revokeId, setRevokeId] = useState<number | null>(null)

  const loadDevices = useCallback(() => {
    setLoading(true)
    api.listDevices().then(setDevices).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadDevices() }, [loadDevices])

  const handleRevoke = (deviceId: number) => {
    api.revokeDevice(deviceId).then(loadDevices).catch(() => {})
    setRevokeId(null)
  }

  const handleToggleTrust = (deviceId: number, isTrusted: boolean) => {
    api.updateDevice(deviceId, { isTrusted: !isTrusted }).then(loadDevices).catch(() => {})
  }

  const handleRevokeSessions = (deviceId: number) => {
    api.revokeDeviceSessions(deviceId).then(loadDevices).catch(() => {})
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Registered Devices</CardTitle>
        <Button aria-label="Refresh registered devices" variant="outline" onClick={loadDevices} disabled={loading}>
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {devices.length === 0 && !loading && (
          <p className="py-6 text-center text-sm text-slate-400">No devices registered</p>
        )}
        {devices.map((d) => (
          <div
            className={cn(
              'flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm',
              d.isRevoked ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100 bg-white',
            )}
            key={d.id}
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{d.deviceName}</p>
                {d.isTrusted && <Badge tone="green">Trusted</Badge>}
                {d.isRevoked && <Badge tone="rose">Revoked</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {d.deviceType} · {d.ipAddress || 'Unknown IP'} · Last used{' '}
                {new Date(d.lastUsedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-1">
              {!d.isRevoked && (
                <>
                  <Button
                    variant="icon"
                    iconOnly
                    onClick={() => handleToggleTrust(d.id, d.isTrusted)}
                    title={d.isTrusted ? 'Remove trust' : 'Mark trusted'}
                  >
                    <Key className={cn('size-3.5', d.isTrusted ? 'text-emerald-500' : 'text-slate-400')} />
                  </Button>
                  <Button
                    variant="icon"
                    iconOnly
                    onClick={() => handleRevokeSessions(d.id)}
                    title="Revoke sessions"
                  >
                    <RefreshCw className="size-3.5 text-amber-500" />
                  </Button>
                  <Button
                    variant="icon"
                    iconOnly
                    onClick={() => setRevokeId(d.id)}
                    title="Revoke device"
                  >
                    <Trash2 className="size-3.5 text-rose-500" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>
      <ConfirmDialog
        open={revokeId !== null}
        title="Revoke device?"
        message="This device will be permanently blocked from accessing FridgeHub. All active sessions will be terminated."
        confirmLabel="Revoke"
        onConfirm={() => { if (revokeId) handleRevoke(revokeId) }}
        onCancel={() => setRevokeId(null)}
      />
    </Card>
  )
}
