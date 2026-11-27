import { useEffect, useState } from 'react';
import { padUi } from '../game/gamepad';

/** true while the player is using a controller (switches button prompts). */
export function usePadMode(): boolean {
  const [pad, setPad] = useState(padUi.lastDevice === 'gamepad');
  useEffect(() => padUi.subscribe((d) => setPad(d === 'gamepad')), []);
  return pad;
}
