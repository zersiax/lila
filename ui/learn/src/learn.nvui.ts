import type { LearnCtrl } from './ctrl';
import { renderNvui } from './view/nvuiView';
import { type NvuiContext, makeContext } from 'lib/nvui/chess';
import { makeSetting, type Setting } from 'lib/nvui/setting';
import { storage } from 'lib/storage';

export type LearnNvuiContext = NvuiContext &
  Readonly<{
    ctrl: LearnCtrl;
    deviceType: Setting<DeviceType>;
  }>;

export interface NvuiPlugin {
  render(): VNode;
}

export function initModule(ctrl: LearnCtrl): NvuiPlugin {
  const ctx = makeContext<LearnNvuiContext>({
    ctrl,
    deviceType: makeSetting<DeviceType>({
      choices: [
        ['desktop', 'Desktop'],
        ['touchscreen', 'Touch screen'],
      ],
      default: 'desktop',
      storage: storage.make('nvui.deviceType'),
    }),
  }, ctrl.redraw);

  return {
    render: () => renderNvui(ctx),
  };
}

type DeviceType = 'desktop' | 'touchscreen';