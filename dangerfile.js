const { message, fail, markdown, danger } = require('danger');
const { stripIndent } = require('common-tags');
const dotProp = require('dot-prop');

function handleMultipleFileChanges() {
  fail(
    'This PR requires a manual review because you are changing more files than just `_data/pixels.json`.'
  );
  markdown(stripIndent`
    ## FAQ

    *Why has my Pull Request failed the tests?*

    Your Pull Request didn't fail the tests but you modified more files with
    this PR than just the \`_data/pixels.json\` file.

    The files you modified are:
    ${danger.git.modified_files.map(name => `- ${name}`).join('\n')}
    ${danger.git.created_files.map(name => `- ${name}`).join('\n')}
    ${danger.git.deleted_files.map(name => `- ${name}`).join('\n')}

    If you did this on purpose, please consider breaking your PR into multiple ones.
    This will help us to auto-verify your pixels change and someone will take a
    look at the remaining PR.

    If you *didn't* do this on purpose, check out https://dangitgit.com/ or
    other resources on how you can revert the remaining changes.
  `);
  // danger.github.utils.createOrAddLabel({
  //   name: 'needs-manual-review',
  //   description: `Changes that don't just modify the pixels.json need manual reviews`,
  //   color: 'F22F46'
  // });
}

function handleSuccessfulSubmission() {
  message('Thank you so much for contributing your pixel! 💖');
  // return danger.github.utils.createOrAddLabel({
  //   name: 'pixel-contribution',
  //   description: `Only changes the pixels.json file. Can be auto-merged`,
  //   color: '36D576'
  // });
}

async function evaluatePixelChanges() {
  const patch = await danger.git.JSONPatchForFile('_data/pixels.json');
  if (patch.diff.length === 1) {
    // Only one pixel has been modified

    const linePatch = patch.diff[0];
    if (linePatch.op === 'add') {
      // a new pixel has been added

      if (isValidNewPixelSubmission(linePatch.value)) {
        return true;
      }
      //   message(stripIndent`
      //   Thank you ${linePatch.value.username} for contributing a ${linePatch
      //     .value.tileName || linePatch.value.color} pixel!
      // `);
    } else if (linePatch.op === 'remove') {
      // a pixel has been removed

      fail(
        `I'm sorry but you can't remove a pixel that someone else contributed`
      );
      return false;
    } else if (linePatch.op === 'replace' || linePatch.op === 'test') {
      return isValidPixelUpdate(patch, linePatch);
    } else {
      fail(
        `I'm sorry but you can only contribute one pixel per GitHub username.`
      );
    }
  } else {
    if (!allPatchesAreForTheSamePixel(patch.diff)) {
      return false;
    } else {
      return isValidPixelUpdate(patch, patch.diff[0]);
    }
  }
  return false;
}

function getIndexFromPath(diffPath) {
  return Number(diffPath.replace('/data/', '').match(/^\d*/)[0]);
}

function allPatchesAreForTheSamePixel(diffs) {
  let currentPixelIndex = undefined;
  for (let diff of diffs) {
    const idx = getIndexFromPath(diff.path);
    if (typeof currentPixelIndex === 'undefined') {
      currentPixelIndex = idx;
    }

    if (currentPixelIndex !== idx) {
      fail(
        'Please make sure all of your changes are on the same line and that you are only modifying one row.'
      );
      return false;
    }
  }
  return true;
}

function isValidPixelUpdate(patch, specificDiff) {
  const gitHubUsername = danger.github.pr.user.login;
  const lastSlash = specificDiff.path.lastIndexOf('/');
  const normalizedPath = specificDiff.path
    .substr(1, lastSlash - 1)
    .replace(/\//g, '.');
  const propertyName = specificDiff.path.substr(lastSlash + 1);
  const newEntry = dotProp.get(patch.after, normalizedPath);

  if (propertyName === 'username') {
    const oldEntry = dotProp.get(patch.before, normalizedPath);
    if (oldEntry.username !== '<UNCLAIMED>') {
      fail(`I'm sorry but you cannot override someone elses pixel.`);
      return false;
    } else if (newEntry.username !== gitHubUsername) {
      fail(
        `The username in your pixel submission needs to match your username of "${gitHubUsername}". You submitted "${newEntry.username}" instead.`
      );
      return false;
    }
  }

  return isValidNewPixelSubmission(newEntry);
}

function isValidNewPixelSubmission(pixel) {
  const gitHubUsername = danger.github.pr.user.login;
  if (pixel.username !== gitHubUsername) {
    fail(
      `The username in your pixel submission needs to match your username of "${gitHubUsername}". You submitted "${pixel.username}" instead.`
    );
    return false;
  }

  if (!pixel.tileName && !pixel.color) {
    fail(
      `Please specify either a color using \`color: '#000000\` or a tile name using \`tileName: 'ground'\` in your pixel.`
    );
    return false;
  }

  if (typeof pixel.x !== 'number' || pixel.x < 0) {
    fail(
      'Please make sure your pixel submission has a valid positive `x` coordinate as a number.'
    );
    return false;
  }

  if (typeof pixel.y !== 'number' || pixel.y < 0) {
    fail(
      'Please make sure your pixel submission has a valid positive `y` coordinate as a number.'
    );
    return false;
  }
  return true;
}

async function run() {
  if (danger.github.thisPR) {
    const hasOnlyPixelChanges =
      danger.git.modified_files.length === 1 &&
      danger.git.modified_files[0] === '_data/pixels.json' &&
      danger.git.created_files.length === 0 &&
      danger.git.deleted_files.length === 0;

    if (!hasOnlyPixelChanges) {
      await handleMultipleFileChanges();
    } else {
      const passed = await evaluatePixelChanges();
      if (passed) {
        await handleSuccessfulSubmission();
      }
    }
  }
}

run().catch(console.error);
