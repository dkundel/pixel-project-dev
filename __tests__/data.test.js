const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);

async function loadPixels() {
  const filePath = path.resolve(__dirname, '../_data/pixels.json');
  const pixelJsonString = await readFile(filePath, 'utf8');
  return JSON.parse(pixelJsonString);
}

describe('pixels', () => {
  test('every username should only claim one pixel', async () => {
    const pixels = await loadPixels();
    const usernameSet = new Set();
    for (const pixel of pixels.data) {
      if (pixel.username !== '<UNCLAIMED>') {
        expect(usernameSet.has(pixel.username)).toBeFalsy();
      }
      usernameSet.add(pixel.username);
    }
  });
});
