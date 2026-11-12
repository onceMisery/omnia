import { View, div } from 'gpui-kit';
import * as fs from 'fs/promises';
import { Buffer } from 'buffer';
import { deflateSync, inflateSync } from 'zlib';
import { echo } from 'omnia-probe';

export default class Probe extends View {
  init(_, cx) {
    this.result = 'pending';
    cx.spawn(async cx => {
      try {
        const payload = Buffer.from([0, 255, 42, 128]);
        const restored = inflateSync(deflateSync(payload));
        await fs.writeFile(__FILE_PATH__, restored);
        const bytes = await fs.readFile(__FILE_PATH__);
        this.result = `${echo('中文')}|${Array.from(bytes).join(',')}`;
      } catch (error) {
        this.result = `failure:${error.message}`;
      }
      cx.notify();
    });
  }
  render() { return div().child(this.result); }
}
