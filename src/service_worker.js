// CORS制限回避のために、
// ホロジュールのHTMLのfetchはバックグラウンド、parseはフォアグラウンドで行う

async function fetchScheduleHtml() {
    // 毎回fetchすると1秒くらい待たされるのでキャッシュする
    const fetchTime = Date.now();

    const lastFetchTime = (await chrome.storage.session.get('lastFetchTime')).lastFetchTime;
    //console.log('lastFetchTime', lastFetchTime);

    const fetchCacheThreshold = 5 * 60 * 1000;

    if (fetchTime - lastFetchTime < fetchCacheThreshold) {
        console.log('fetchScheduleHtml: fetch from cache');
        return (await chrome.storage.session.get('lastFetchHtml')).lastFetchHtml;
    }
    console.log('fetchScheduleHtml: fetch from website');

    const response = await fetch('https://schedule.hololive.tv/lives');
    if (!response.ok) {
        console.error('fetch failed');
        return null;
    }

    const html = await response.text();

    await chrome.storage.session.set({
        'lastFetchTime': fetchTime,
        'lastFetchHtml': html,
    });

    return html;
}

async function queryOptions() {
    return (await chrome.storage.local.get('options')).options ?? {
        filter: {},
        misc: {}
    };
}

async function updateOptions(newOptions) {
    const oldOptions = await queryOptions();
    const options = { ...oldOptions, ...newOptions };
    await chrome.storage.local.set({ options: options });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse_) => {
    const [command, args] = message;
    console.log(command, ...args);

    sendResponse = (response) => {
        if (command === 'fetchScheduleHtml') {
            console.log('  sendResponse', '... (typeof ' + (typeof response) + ')');
        } else {
            console.log('  sendResponse', response);
        }
        sendResponse_(response);
    };

    switch (command) {
    // ホロジュールのhtmlを取得
    case 'fetchScheduleHtml':
        fetchScheduleHtml().then(html => sendResponse(html));
        return true;
    case 'queryOptions':
        queryOptions().then(options => sendResponse(options));
        return true;
    case 'updateOptions':
        updateOptions(args[0]).then(() => sendResponse());
        return true;
    }
});
