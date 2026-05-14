const fs = require('fs');
const path = require('path');
const https = require('https');

const voicesDir = path.join(__dirname, 'voices');
if (!fs.existsSync(voicesDir)) {
  fs.mkdirSync(voicesDir);
}

const voices = [
  'ryan/high/en_US-ryan-high',
  'joe/medium/en_US-joe-medium',
  'john/medium/en_US-john-medium',
  'amy/low/en_US-amy-low',
  'kathleen/low/en_US-kathleen-low',
  'kristin/medium/en_US-kristin-medium'
];

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
};

async function run() {
  for (const v of voices) {
    const name = v.split('/')[2];
    const baseUrl = `https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/${v}`;
    console.log(`Downloading ${name}...`);
    try {
      await downloadFile(`${baseUrl}.onnx`, path.join(voicesDir, `${name}.onnx`));
      await downloadFile(`${baseUrl}.onnx.json`, path.join(voicesDir, `${name}.onnx.json`));
    } catch (e) {
      console.error(e);
    }
  }
  console.log('Done downloading voices.');
}

run();
