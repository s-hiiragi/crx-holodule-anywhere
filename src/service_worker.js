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

async function writeSchedule() {
    // TODO ホロジュールデータをstorageに保存する
}

async function readSchedule() {
    // TODO ホロジュールデータをstorageから読みだす
    return null;
}

// CORS制限回避のために、
// fetchはバックグラウンド、parseはフォアグラウンドで行う

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const [command, ...args] = message;
    console.log(command, args);

    switch (command) {
    // ホロジュールのhtmlを取得
    case 'fetchScheduleHtml':
        fetchScheduleHtml().then(html => sendResponse(html));
        return true;
    // ホロジュールデータを保存
    case 'writeSchedule':
        writeSchedule(args[0]).then(() => sendResponse());
        return true;
    // ホロジュールデータを取得
    case 'readSchedule':
        readSchedule().then(schedule => sendResponse(schedule));
        return true;
    }
});
