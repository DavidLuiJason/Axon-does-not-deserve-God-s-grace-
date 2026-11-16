// One entry point for everything built by D47: the screen reader, AXON Apps, the auto-clicker and the phone self-test.
// The brain, a tool, or (later) a screen asks this object; nothing else needs to know how the parts fit.
import { createStructureSource } from '../screen-intelligence/structure-source.mjs';
import { createScreenActor } from '../screen-intelligence/screen-actor.mjs';
import { runScreenSelfTest } from '../screen-intelligence/screen-selftest.mjs';
import { createAppsSource } from '../axon-apps/apps-source.mjs';
import { createAppProfiles } from '../axon-apps/app-profiles.mjs';
import { createAppsController } from '../axon-apps/apps-controller.mjs';
import { createRoutineRunner } from '../axon-autoclicker/routine-runner.mjs';
import { createRecorder } from '../axon-autoclicker/recorder.mjs';

/** @param {any} [options] */
export function createScreenSystem({ screenPlugin, appsPlugin, policy = {}, ownPackage = 'com.axon.app', profiles: profilesData, now, wait, onEvent } = {}) {
  const clock = { ...(now ? { now } : {}), ...(wait ? { wait } : {}) };
  const screen = createStructureSource(screenPlugin);
  const apps = createAppsSource(appsPlugin);
  const profiles = createAppProfiles(profilesData);
  const controller = createAppsController({ screen, apps, profiles, policy, ...clock });
  const runner = createRoutineRunner({ controller, screen, ownPackage, onEvent, ...clock });
  const recorder = createRecorder({ source: screen });
  return {
    screen, apps, profiles, controller, runner, recorder,
    /** Plain-words state of the whole system: is the reader on, how many apps, is the kill switch armed. */
    async status() {
      const reader = await screen.getStatus();
      const list = await apps.listApps();
      const kill = await screen.getKillState();
      return { readerOn: reader.serviceEnabled === true, canAct: reader.canAct === true, appCount: list.ok ? list.apps.length : null, appsCode: list.ok ? null : list.code, stopRequested: kill.stopRequested, killSwitchAvailable: kill.available, running: runner.isRunning() };
    },
    selfTest: (options = {}) => runScreenSelfTest({ source: screen, actor: createScreenActor({ source: screen, apps, policy, ...clock }), options }),
  };
}
