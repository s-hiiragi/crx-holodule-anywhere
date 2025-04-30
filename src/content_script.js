async function sendMessage(command, ...args) {
    return await chrome.runtime.sendMessage([command, args]);
}

function extractStreams(doc) {
    const containers = Array.from(doc.querySelectorAll('#all > .container > .row > div'));

    let allStreams = [];

    let lastYear  = '';
    let lastMonth = '';
    let lastDate  = '';

    containers.forEach(container => {
        // カルーセルパネルはスキップ
        if (container.querySelector('#carouselExampleIndicators') !== null) {
            return;
        }

        const navBar = container.querySelector('.navbar-text');
        if (navBar !== null) {
            const dateStr = navBar.textContent.replace(/\s+/g, '');
            const m = /(\d+)\/(\d+)/.exec(dateStr);
            if (m) {
                //console.log('navBar: ' + m[1] + '/' + m[2]);
                lastYear  = new Date().getFullYear();
                lastMonth = parseInt(m[1], 10);
                lastDate  = parseInt(m[2], 10);
            }
        }
        else {
            const thumbnails = Array.from(container.querySelectorAll('a.thumbnail'));

            const streams = thumbnails.map(a => {
                const streamUrl = a.href;
                const startTimeStr = a.querySelector('.datetime').textContent.trim();
                const talentName = a.querySelector('.name').textContent.trim();
                const imageUrl = a.querySelector('.container > .row > div:nth-of-type(2) > img').src;
                const iconUrls = Array.from(a.querySelectorAll('.container > .row > div:nth-of-type(3) img')).map(e => e.src);

                const [hours, minutes] = startTimeStr.split(':');
                const startDate = new Date(lastYear, lastMonth-1, lastDate, hours, minutes);

                return {
                    streamUrl : streamUrl,
                    startDate : startDate,
                    talentName: talentName,
                    imageUrl  : imageUrl,
                    iconUrls  : iconUrls,
                    live      : a.style.border === '3px solid red'
                };
            });

            if (streams.length > 0) {
                //console.log(streams);
                allStreams = [...allStreams, ...streams];
            }
        }
    });

    return allStreams;
}

async function fetchStreams() {
    const text = await sendMessage('fetchScheduleHtml');
    //console.log('text', text);

    const doc = new DOMParser().parseFromString(text, 'text/html');
    //console.log('doc', doc);

    // 配信リストを抽出
    // 日時、配信者名、配信URL、サムネイルURL、アイコンURLリスト
    const streams = extractStreams(doc);
    //console.log('streams', streams);
    return streams;
}

const ProgramGuideStyle = document.createElement('style');

ProgramGuideStyle.textContent = `
    :host {
        position: fixed;
        top: 0px;
        left: 0px;
        width: 100%;
        z-index: calc(infinity);

        white-space: nowrap;
        overflow-x: scroll;

        /*
         * 親要素を水平方向を軸に180度回転し、子要素をさらに180度回転させることで
         * スクロールバーを上方向に表示するハック
         */
        transform: rotateX(180deg);
    }

    :host .stream-box {
        display: inline-block;
        transform: rotateX(180deg);
    }

    :host .time-box {
        display: block;
        color: black;
        background-color: rgba(255, 255, 255, 1);
    }

    :host .time-box.morning {
        background-color: pink;
    }
    :host .time-box.afternoon {
        background-color: lightgreen;
    }
    :host .time-box.evening {
        background-color: skyblue;
    }
    :host .time-box.night {
        background-color: mediumpurple;
    }

    :host .time-box .time {
        font-size: 14px;
    }

    :host .time-box .date {
        margin-right: 0.5em;
        font-weight: bold;
    }

    :host .time-box .name {
        margin-left: 0.5em;
        font-size: 12px;
    }

    :host .stream {
        display: block;
        /* サムネイルを上揃えにする */
        vertical-align: bottom;  /* rotateX(180deg)しているのでtopではなくbottomにする */
    }

    :host .stream:focus {
        /* フォーカス時のアウトライン表示をカスタムしたいので消す */
        outline: none;
    }

    :host .stream img {
        padding: 2px;
        background-color: white;
        border: 1px solid black;
    }

    :host .live img {
        padding: 0px;
        border: 3px solid red;
        border-radius: 4px;
    }

    :host .selected img {
        /* フォーカス時に表示する枠 */
        padding: 3px;
        background-color: white;
        border: 2px solid black;
        border-radius: 4px;
        /* フォーカス時はサムネイルのサイズを変える */
        height: 100px;
    }

    :host .live.selected img {
        background-color: red;
    }
`;

function getNearStreamIndex(streams, targetTime) {
    const [_, nearIndex] = streams.reduce(
        ([maxDiff, nearIndex], currStream, currIndex) => {
            lastCurrStream = currStream;
            const diff = Math.abs(targetTime - currStream.startDate.getTime());
            if (diff < maxDiff) {
                return [diff, currIndex];
            } else {
                return [maxDiff, nearIndex];
            }
        }, [Infinity, 0]);

    return nearIndex;
}

function getTimePeriod(date) {
    const h = date.getHours();
    if (h < 6) {
        return 'night';
    }
    else if (h < 12) {
        return 'morning';
    }
    else if (h < 18) {
        return 'afternoon';
    }
    else if (h < 21) {
        return 'evening';
    }
    else {
        return 'night';
    }
}

class ProgramGuideClass {

    constructor() {
        this._streams = [];  // loadStream()で読み込む
        this._streamIndexData = 0;

        this._container = document.createElement('div');
        this._container.classList.add('crx-holodule-anywhere-container');
        this._container.style.visibility = 'hidden';  // 初期状態は非表示

        this._shadowRoot = this._container.attachShadow({ mode: 'open' });
        this._shadowRoot.appendChild(ProgramGuideStyle);

        document.body.appendChild(this._container);
    }

    // 画像のロード処理に時間がかかるのでconstructorから切り離す
    async loadStream(streams) {
        // 前回の内容を消す
        Array.from(this._shadowRoot.querySelectorAll('.stream-box')).forEach(e => {
            e.remove();
        });

        if (this._streams.length === 0) {
            // 初回ロード時

            // 現在時刻に近い配信を選択する
            this._streamIndexData = getNearStreamIndex(streams, Date.now());
        }
        else {
            // 2回目以降のロード時
            // 前回選択していた配信を選択し直す
            const lastSelectedStream = this._streams[this._streamIndexData];

            const foundStreamIndex = streams.findIndex(s => s.streamUrl === lastSelectedStream.streamUrl);
            if (foundStreamIndex === -1) {
                // 前回選択していた配信が消えた場合
                // 現在時刻に近い配信を再選択する
                this._streamIndexData = getNearStreamIndex(streams, Date.now());
            }
            else {
                this._streamIndexData = foundStreamIndex;
            }
        }

        this._streams = streams;

        const onloadPromises = [];
        let lastDate = -1;

        for (let stream of this._streams) {
            const streamBox = document.createElement('span');
            streamBox.classList.add('stream-box');
            this._shadowRoot.appendChild(streamBox);

            if (stream.live) {
                streamBox.classList.add('live');
            }

            if (stream === this._streams[this._streamIndex]) {
                streamBox.classList.add('selected');
            }

            const timeBox = document.createElement('span');
            timeBox.classList.add('time-box');
            streamBox.appendChild(timeBox);

            const period = getTimePeriod(stream.startDate);
            timeBox.classList.add(period);

            const t = document.createElement('span');
            t.classList.add('time');
            t.textContent = ('0' + stream.startDate.getHours()).slice(-2) + ':' + ('0' + stream.startDate.getMinutes()).slice(-2);
            timeBox.appendChild(t);

            if (stream.startDate.getDate() !== lastDate) {
                const d = document.createElement('span');
                d.classList.add('date');
                d.textContent = (stream.startDate.getMonth() + 1) + '/' + stream.startDate.getDate();
                t.prepend(d);

                lastDate = stream.startDate.getDate();
            }

            const n = document.createElement('span');
            n.classList.add('name');
            n.textContent = stream.talentName;
            timeBox.appendChild(n);

            const a = document.createElement('a');
            a.classList.add('stream');
            a.href = stream.streamUrl;
            streamBox.appendChild(a);

            const img = document.createElement('img');

            onloadPromises.push(new Promise(resolve => {
                img.addEventListener('load', () => { resolve(); });
            }));

            img.src = stream.imageUrl;
            img.height = 70;  // default size: 250x140.625
            a.appendChild(img);
        }

        return Promise.allSettled(onloadPromises);
    }

    get _streamIndex() {
        return this._streamIndexData;
    }

    set _streamIndex(value) {
        // ラップアラウンド方式にする
        if (value < 0) {
            value = this._streams.length - 1;
        }
        else if (this._streams.length <= value) {
            value = 0;
        }

        this._streamIndexData = value;
        this._selectStream(value);
    }

    _selectStream(index) {
        const lastSelectedStreamBox = this._shadowRoot.querySelector('.selected');
        if (lastSelectedStreamBox !== null) {
            lastSelectedStreamBox.classList.remove('selected');
        }

        const selectedStreamBox = this._shadowRoot.querySelectorAll('.stream-box')[index];
        selectedStreamBox.classList.add('selected');
        selectedStreamBox.scrollIntoView();
        selectedStreamBox.focus();

        // 選択した配信を中央にスクロール表示する
        const containerWidth = this._container.offsetWidth;
        const selectedWidth = selectedStreamBox.offsetWidth;
        const halfWidth = (containerWidth - selectedWidth) / 2;
        const initialLeft = Math.max(selectedStreamBox.offsetLeft - halfWidth, 0);
        //console.log('containerWidth=' + containerWidth, ' selectedWidth=' + selectedWidth + ' selectedOffsetLeft=' + selectedStreamBox.offsetLeft);
        this._container.scrollTo(initialLeft, 0);
    }

    get shown() {
        return this._container.style.visibility !== 'hidden';
    }

    hide() {
        this._container.style.visibility = 'hidden';
    }

    toggle() {
        if (this._container.style.visibility === 'hidden') {
            // ガイド表示前にフォーカスしていた要素を覚えておく
            this._lastActiveElement = document.activeElement;

            this._container.style.visibility = 'visible';

            // 最後に選択した配信をフォーカスする
            this._selectStream(this._streamIndex);
        } else {
            this._container.style.visibility = 'hidden';

            // ガイド表示前にフォーカスしていた要素のフォーカスを復元する
            this._lastActiveElement.focus();
        }
    }

    scrollBy(delta) { this._streamIndex += delta; }

    scrollTo(index) {
        if (index >= 0) {
            this._streamIndex = index;
        } else {
            this._streamIndex = index + this._streams.length;
        }
    }

    openStream(options = {}) {
        if (options.newTab) {
            window.open(this._streams[this._streamIndex].streamUrl, '_blank');
            this.hide();
        } else {
            location.href = this._streams[this._streamIndex].streamUrl;
        }
    }
}

const hololiveJPNames = [
    'ホロライブ',
    'ときのそら', 'ロボ子さん',   'AZKi',       'さくらみこ', '星街すいせい',
    'アキロゼ',   '赤井はあと',   '白上フブキ', '夏色まつり',
    '百鬼あやめ', '癒月ちょこ',   '大空スバル',
    '大神ミオ',   '猫又おかゆ',   '戌神ころね',
    '兎田ぺこら', '不知火フレア', '白銀ノエル', '宝鐘マリン',
    '天音かなた', '角巻わため',   '常闇トワ',   '姫森ルーナ',
    '雪花ラミィ', '桃鈴ねね',     '尾丸ポルカ', '獅白ぼたん',
    'ラプラス',   '鷹嶺ルイ',     '博衣こより', '風真いろは'
];
const hololiveIDNames = [
    'Risu',  'Moona', 'Iofi',
    'Ollie', 'Anya',  'Reine',
    'Zeta',  'Kaela', 'Kobo'
];
const hololiveENNames = [
    'Calli',     'Kiara',  'Ina',
    'IRyS',      'Kronii', 'Baelz',
    'Shiori',    'Bijou',  'Nerissa', 'FUWAMOCO',
    'Elizabeth', 'Gigi',   'Cecilia', 'Raora'
];
const hololiveDEV_ISNames = [
    '火威青',     '音乃瀬奏',   '一条莉々華', '儒烏風亭らでん', '轟はじめ',
    '響咲リオナ', '虎金妃笑虎', '水宮枢',     '輪堂千速',       '綺々羅々ヴィヴィ'
];
const hololiveAllNames = [
    ...hololiveJPNames,
    ...hololiveIDNames,
    ...hololiveENNames,
    ...hololiveDEV_ISNames
];

let ProgramGuide = new ProgramGuideClass();

async function updateProgramGuide() {
    // 非表示のときだけ取得する
    if (ProgramGuide.shown) {
        return;
    }

    //console.log('holodule fetch start');
    let streams = await fetchStreams();

    // ホロライブのみフィルタ
    const filterOptions = (await sendMessage('queryOptions')).filter;
    //console.log('filterOptions', filterOptions);

    // 有効なグループ名を取り出す
    const enableGroups = Object.entries(filterOptions).filter(([k,v]) => v).map(([k,v]) => k);

    // グループ名をタレント名に変換する
    const enableTalentNames = enableGroups.map(g => talentNamesByGroup[g]).flat();

    streams = streams.filter(stream => {
        return enableTalentNames.includes(stream.talentName);
    });

    //console.log('holodule fetch end');

    await ProgramGuide.loadStream(streams);
}

const globalKeyActions = [
    { code: 'KeyE',                  action: async() => { await updateProgramGuide(); ProgramGuide.toggle(); } },
    { code: 'KeyZ',                  action: async() => { await updateProgramGuide(); ProgramGuide.toggle(); } },
    { code: 'KeyH',                  action: async() => { await updateProgramGuide(); ProgramGuide.toggle(); } },
    { code: 'Escape',                condition: () => ProgramGuide?.shown, action: () => ProgramGuide.hide() },
    { code: 'ArrowLeft',             condition: () => ProgramGuide?.shown, action: () => ProgramGuide.scrollBy(-1) },
    { code: 'ArrowRight',            condition: () => ProgramGuide?.shown, action: () => ProgramGuide.scrollBy(+1) },
    { code: 'KeyA',                  condition: () => ProgramGuide?.shown, action: () => ProgramGuide.scrollBy(-1) },
    { code: 'KeyD',                  condition: () => ProgramGuide?.shown, action: () => ProgramGuide.scrollBy(+1) },
    { code: 'Tab', shiftKey: true,   condition: () => ProgramGuide?.shown, action: () => ProgramGuide.scrollBy(-1) },
    { code: 'Tab',                   condition: () => ProgramGuide?.shown, action: () => ProgramGuide.scrollBy(+1) },
    { code: 'Home',                  condition: () => ProgramGuide?.shown, action: () => ProgramGuide.scrollTo(0) },
    { code: 'End',                   condition: () => ProgramGuide?.shown, action: () => ProgramGuide.scrollTo(-1) },
    { code: 'Enter',                 condition: () => ProgramGuide?.shown, action: () => ProgramGuide.openStream() },
    { code: 'Space',                 condition: () => ProgramGuide?.shown, action: () => ProgramGuide.openStream() },
    { code: 'Enter', shiftKey: true, condition: () => ProgramGuide?.shown, action: () => ProgramGuide.openStream({newTab: true}) },
    { code: 'Space', shiftKey: true, condition: () => ProgramGuide?.shown, action: () => ProgramGuide.openStream({newTab: true}) }
];

function globalKeyEventListener(event) {
    //console.log(event.code, event.isComposing, event, document.activeElement);

    // IME入力中判定
    if (event.isComposing || event.key === 'Process' || event.keyCode === 229) {
        return;
    }

    // WAI-ARIA role判定
    if (['textbox', 'searchbox', 'combobox'].includes(event.target.role)) {
        //console.log('role = ' + event.target.role);
        return;
    }

    // contentEditable有効判定
    // TODO inherit(親の属性を継承)に対応する
    if (['true', 'plaintext-only'].includes(event.target.contentEditable)) {
        //console.log('contentEditable = ' + event.target.contentEditable);
        return;
    }

    // ノード名判定
    // - x.comのGrokのテキストボックスにはWAI-ARIAが設定されておらず、かつkeydownイベントが伝播するため対処する
    const nodeName = event.target.nodeName.toLowerCase();
    if (['input', 'textarea'].includes(nodeName)) {
        //console.log('nodeName = ' + event.target.nodeName);
        return;
    }

    for (a of globalKeyActions) {
        if (event.code === a.code &&
            event.altKey === !!a.altKey &&
            event.ctrlKey === !!a.ctrlKey &&
            event.metaKey === !!a.metaKey &&
            event.shiftKey === !!a.shiftKey &&
            (!a.condition || a.condition())) {

            //console.log('perform action', a.action);
            event.preventDefault();
            event.stopPropagation();
            a.action();
        }
    }
}

function main() {
    window.addEventListener('keydown', globalKeyEventListener);
}

main();
