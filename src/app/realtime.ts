/**
 * Cross-tab realtime, using the browser's BroadcastChannel.
 *
 * The spec calls for the host to get an instant alert when a visitor asks for
 * approval, and for the front desk to see the answer straight away. With no
 * server there is nothing to push over a socket - but two tabs of this app are
 * two users, and BroadcastChannel delivers a message to every other tab on the
 * same origin in a few milliseconds.
 *
 * That makes the demo real rather than faked: open the front desk in one tab and
 * the host portal in another, register a walk-in, and the host's notification
 * bell updates without a refresh.
 *
 * Every tab generates the same seeded dataset, so a patch identified by visit id
 * applies cleanly everywhere.
 */
import type { AuditEntry, Visit, Visitor } from '@/domain/types';

export type RealtimeMessage =
  | { type: 'VISIT_CHANGED'; visitId: string; patch: Partial<Visit>; audit: AuditEntry }
  | { type: 'VISIT_CREATED'; visit: Visit; visitor?: Visitor; audit: AuditEntry }
  | { type: 'DATASET_RESEEDED'; visitCount: number };

const CHANNEL_NAME = 'vms-realtime';

/** Identifies this tab, so we can ignore the echo of our own messages. */
export const TAB_ID = Math.random().toString(36).slice(2);

interface Envelope {
  sender: string;
  message: RealtimeMessage;
}

/**
 * BroadcastChannel is unavailable in older browsers and in some test
 * environments, so every use is guarded and the app degrades to single-tab.
 */
const channel: BroadcastChannel | null =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);

export const isRealtimeSupported = channel !== null;

export function publish(message: RealtimeMessage): void {
  channel?.postMessage({ sender: TAB_ID, message } satisfies Envelope);
}

/** Subscribes to messages from *other* tabs. Returns an unsubscribe function. */
export function subscribe(handler: (message: RealtimeMessage) => void): () => void {
  if (!channel) return () => {};

  const listener = (event: MessageEvent<Envelope>) => {
    const envelope = event.data;
    if (!envelope || envelope.sender === TAB_ID) return;
    handler(envelope.message);
  };

  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
}
