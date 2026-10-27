import { Vector3 } from 'three'

import { SPAWN } from '@shared/world'

/**
 * Per-frame mutable state shared between systems.
 *
 * Deliberately outside React and zustand: it changes every frame, nothing should
 * re-render because of it, and every reader lives in a `useFrame` or a timer. UI that
 * needs a slow-changing derivative of it (which zone the player is in, say) gets it
 * from the 10 Hz game ticker, which is the only thing that copies from here into the
 * store.
 */
export const runtime = {
  player: {
    position: new Vector3(SPAWN.x, 0, SPAWN.z),
    /**
     * Where the player is going or aiming, radians about +Y. PI is north (-Z), towards
     * the course. Walking sets it; a shot flies along it.
     */
    heading: Math.PI,
    /**
     * Which way the body faces, radians about +Y: the heading while walking, turned
     * SIDE_ON from it standing over the ball (a golfer's shot goes off their left).
     * Derived from `heading` by the controller every frame.
     */
    yaw: Math.PI,
    speed: 0,
    grounded: true,
    /** 'idle' | 'walk' | 'jump' | 'throw' - what other players see. */
    anim: 'idle',
    /** Seconds left on the current throw swing, driving the arm pose. */
    throwTimer: 0,
    /** Seconds left on the full swing off the Hit Zone (see FULL_SWING_TIME). */
    swingTimer: 0,
    /** 0-1: how far into the golf stance over the ball (eased by the controller). */
    address: 0,
    /** Standing on a duel ring from the swing to the end of the result (see duel.js). */
    dueling: false,
    /** This duel's shot is away (the ball is gone from the tee). */
    duelShot: false,
    /** A duel's ending, danced or wept: 'win' | 'lose' | null, from `emoteAt` (ms). */
    emote: null,
    emoteAt: 0,
    /** Where the club head rests at the address, relative to the player: ahead, and to the left. */
    teeForward: 0.95,
    teeLeft: -0.2,
    /** Throws started so far; other players see one each time it goes up. */
    throwSeq: 0,
    /** True from a throw's release until the frisbee is back in the hand. */
    frisbeeAway: false,
    /** Seconds left on the catch when the frisbee comes back. */
    catchTimer: 0,
    /** World position of the frisbee in the hand: where throws leave from. */
    frisbeeAt: new Vector3(SPAWN.x, 1, SPAWN.z),
    /** Set when the controller should ignore input (flight, cutscenes). */
    frozen: false,
  },

  /** Touch input, written by the on-screen joystick. -1..1, +y = forward. */
  input: {
    joyX: 0,
    joyY: 0,
    jump: false,
  },

  /** How fast game time runs: below 1 for slow motion (the strike). Written by the flight. */
  timeScale: 1,

  /** Screen-feel effects, decayed by FollowCamera: `punch` 0-1 is the impact kick. */
  fx: { punch: 0 },

  camera: {
    /** 'follow' orbits the player; 'flight' is driven by the flight sequence. */
    mode: 'follow',
    yaw: 0,
    pitch: 0.36,
    distance: 11,
    /** Set to jump the follow camera straight to its target next frame. */
    snap: false,
    /** Shifts what the follow camera aims at, off the player (the swing's framing). */
    lookOffset: new Vector3(),
    /** Overrides how quickly the follow camera eases into place (the swing's slow dolly-in). */
    ease: null,
  },

  /** What the sun's shadow box centres on while the camera chases a thrown plane. */
  flightFocus: null,

  /**
   * Other players' pets, written by the multiplayer layer: `{ id, position, yaw, hop }`
   * per pet. Drawn by the same instanced pet meshes as yours.
   */
  remotePets: [],

  /**
   * Other players' throws to replay as ghost planes:
   * `{ sid, distance, duration, planeId, x, z, startedAt }`.
   */
  ghostThrows: [],

  /** Walls that come and go at runtime, e.g. locked training lanes. */
  dynamicColliders: [],

  /**
   * Things that get a blob shadow on low presets. Each entry is
   * `{ position: Vector3, size: number, visible?: boolean }`.
   */
  shadowCasters: new Set(),
}

/** How far a golfer standing over the ball turns from the line of the shot: side-on. */
export const SIDE_ON = Math.PI / 2

/** Puts the player back at spawn, e.g. after a reconnect into a fresh lobby. */
export function respawn() {
  runtime.player.position.set(SPAWN.x, 0, SPAWN.z)
  runtime.player.heading = Math.PI
  runtime.player.yaw = Math.PI
}
