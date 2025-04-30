async function sendMessage(command, ...args) {
    console.log('args = ' + args);
    console.log('sendMessage', command, ...args);
    return await chrome.runtime.sendMessage([command, args]);
}

function gatherOptions(checkBoxes, datasetName) {
    return Object.fromEntries(checkBoxes.map(e => [e.dataset[datasetName], e.checked]));
}

function checkGroup(checkBoxes, group, checked) {
    for (let cb of checkBoxes) {
        const name = cb.dataset.filter;

        if (name.startsWith(group) && name !== group) {
            cb.checked = checked;
        }
    }
}

function setupFilterOptions(options) {
    const checkBoxes = Array.from(document.querySelectorAll('input[type="checkbox"][data-filter]'));

    for (let cb of checkBoxes) {
        cb.checked = options[cb.dataset.filter] ?? true;  // デフォルト有効

        cb.onchange = async() => {
            // 同じグループのチェックボックスを一括でチェックorチェック解除する
            checkGroup(checkBoxes, cb.dataset.filter, cb.checked);

            const filterOptions = gatherOptions(checkBoxes, 'filter');
            await sendMessage('updateOptions', { filter: filterOptions });
        };
    }
}

function setupMiscOptions(options) {
    const checkBoxes = Array.from(document.querySelectorAll('input[type="checkbox"][data-misc]'));

    for (let cb of checkBoxes) {
        cb.checked = options[cb.dataset.misc] ?? false;  // デフォルト無効

        cb.onchange = async() => {
            await sendMessage('updateOptions', { misc: gatherOptions(checkBoxes, 'misc') });
        };
    }
}

async function main() {
    const options = await sendMessage('queryOptions');

    setupFilterOptions(options.filter);
    setupMiscOptions(options.misc);
}

main();
