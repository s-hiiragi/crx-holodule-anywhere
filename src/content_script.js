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
    const text = await chrome.runtime.sendMessage(['fetchScheduleHtml', []]);
    //console.log('text', text);

    const doc = new DOMParser().parseFromString(text, 'text/html');
    //console.log('doc', doc);

    // 配信リストを抽出
    // 日時、配信者名、配信URL、サムネイルURL、アイコンURLリスト
    const streams = extractStreams(doc);
    //console.log('streams', streams);
    return streams;
}

let Streams = [
   // Sample Data
   {streamUrl: 'https://www.youtube.com/watch?v=4RYbmR8oJHw',
     imageUrl: 'https://img.youtube.com/vi/4RYbmR8oJHw/mqdefault.jpg'},
   {streamUrl: 'https://www.youtube.com/watch?v=JKt4Dbpg3Vw',
     imageUrl: 'https://img.youtube.com/vi/JKt4Dbpg3Vw/mqdefault.jpg'},
   {streamUrl: 'https://www.youtube.com/watch?v=YeBTV22C06g',
     imageUrl: 'https://img.youtube.com/vi/YeBTV22C06g/mqdefault.jpg'},
   {streamUrl: 'https://www.youtube.com/watch?v=_Ifx-t9UIwM',
     imageUrl: 'https://img.youtube.com/vi/_Ifx-t9UIwM/mqdefault.jpg'},
   {streamUrl: 'https://www.youtube.com/watch?v=ZRtpdxWvYTw',
     imageUrl: 'https://img.youtube.com/vi/ZRtpdxWvYTw/mqdefault.jpg'},
   {streamUrl: 'https://www.youtube.com/watch?v=AxUY1LV7Q6A',
     imageUrl: 'https://img.youtube.com/vi/AxUY1LV7Q6A/mqdefault.jpg',
         live: true},
   {streamUrl: 'https://www.youtube.com/watch?v=GR82EoZr-fU',
     imageUrl: 'https://img.youtube.com/vi/GR82EoZr-fU/mqdefault.jpg'},
   {streamUrl: 'https://www.youtube.com/watch?v=vh3hhmmctkE',
     imageUrl: 'https://img.youtube.com/vi/vh3hhmmctkE/mqdefault.jpg'},
   {streamUrl: 'https://www.youtube.com/watch?v=v-2eM7LoNq8',
     imageUrl: 'https://img.youtube.com/vi/v-2eM7LoNq8/mqdefault.jpg'},
   {streamUrl: 'https://www.youtube.com/watch?v=ROSrFN_MWxE',
     imageUrl: 'https://img.youtube.com/vi/ROSrFN_MWxE/mqdefault.jpg'},
   {streamUrl: 'https://www.youtube.com/watch?v=1IaFnJE7JsE',
     imageUrl: 'https://img.youtube.com/vi/1IaFnJE7JsE/mqdefault.jpg'},
   {streamUrl: 'https://www.youtube.com/watch?v=sxhryjeUXlk',
     imageUrl: 'https://img.youtube.com/vi/sxhryjeUXlk/mqdefault.jpg'}
];

const ProgramStyle = document.createElement('style');

ProgramStyle.textContent = `
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

    :host .stream {
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
        transform: rotateX(180deg);
    }

    :host .stream.live img {
        padding: 0px;
        border: 3px solid red;
        border-radius: 4px;
    }

    :host .stream.selected img {
        /* フォーカス時に表示する枠 */
        padding: 3px;
        background-color: white;
        border: 2px solid black;
        border-radius: 4px;
        /* フォーカス時はサムネイルのサイズを変える */
        height: 100px;
    }

    :host .stream.live.selected img {
        background-color: red;
    }
`;

function getNearStreamIndex(targetTime) {
    const [_, nearIndex] = Streams.reduce(
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

class ProgramClass {

    constructor() {
        this._streams = [];  // loadStream()で読み込む
        this._streamIndexData = 0;

        this._container = document.createElement('div');
        this._container.classList.add('crx-holodule-anywhere-container');
        this._container.style.visibility = 'hidden';  // 初期状態は非表示

        this._shadowRoot = this._container.attachShadow({ mode: 'open' });
        this._shadowRoot.appendChild(ProgramStyle);

        document.body.appendChild(this._container);
    }

    // 画像のロード処理に時間がかかるのでconstructorから切り離す
    async loadStream(streams) {
        this._streams = streams;

        // 現在時刻に近い配信を選択する
        this._streamIndexData = getNearStreamIndex(Date.now());
        //console.log('nearIndex', this._streamIndexData);

        const onloadPromises = [];

        for (let stream of this._streams) {
            const a = document.createElement('a');
            a.classList.add('stream');
            a.href = stream.streamUrl;
            this._shadowRoot.appendChild(a);

            if (stream.live) {
                a.classList.add('live');
            }

            if (stream === this._streams[this._streamIndex]) {
                a.classList.add('selected');
            }

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
        const lastSelectedStream = this._shadowRoot.querySelector('.stream.selected');
        lastSelectedStream.classList.remove('selected');

        const selectedStream = this._shadowRoot.querySelectorAll('.stream')[index];
        selectedStream.classList.add('selected');
        selectedStream.scrollIntoView();
        selectedStream.focus();

        // 選択した配信を中央にスクロール表示する
        const containerWidth = this._container.offsetWidth;
        const selectedWidth = selectedStream.offsetWidth;
        const halfWidth = (containerWidth - selectedWidth) / 2;
        const initialLeft = Math.max(selectedStream.offsetLeft - halfWidth, 0);
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

    selectPrevHour() {}  // TODO 実装する
    selectNextHour() {}  // TODO 実装する

    openStream(options) {
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

let Program = null;

async function initProgram() {
    if (Program !== null) {
        return;
    }

    //console.log('holodule fetch start');
    let streams = await fetchStreams();

    // ホロライブのみフィルタ
    streams = streams.filter(stream => {
        return hololiveAllNames.includes(stream.talentName);
    });
    Streams.splice(0, Streams.length, ...streams);

    //console.log('holodule fetch end');

    Program = new ProgramClass();
    await Program.loadStream(Streams);
}

const globalKeyActions = [
    { code: 'KeyE',                  action: async() => { await initProgram(); Program.toggle(); } },
    { code: 'KeyZ',                  action: async() => { await initProgram(); Program.toggle(); } },
    { code: 'KeyH',                  action: async() => { await initProgram(); Program.toggle(); } },
    { code: 'Escape',                condition: () => Program?.shown, action: () => Program.hide() },
//  { code: 'ArrowUp',               condition: () => Program?.shown, action: () => Program.selectPrevHour() },
//  { code: 'ArrowDown',             condition: () => Program?.shown, action: () => Program.selectNextHour() },
//  { code: 'KeyW',                  condition: () => Program?.shown, action: () => Program.selectPrevHour() },
//  { code: 'KeyS',                  condition: () => Program?.shown, action: () => Program.selectNextHour() },
    { code: 'ArrowLeft',             condition: () => Program?.shown, action: () => Program.scrollBy(-1) },
    { code: 'ArrowRight',            condition: () => Program?.shown, action: () => Program.scrollBy(+1) },
    { code: 'KeyA',                  condition: () => Program?.shown, action: () => Program.scrollBy(-1) },
    { code: 'KeyD',                  condition: () => Program?.shown, action: () => Program.scrollBy(+1) },
    { code: 'Tab', shiftKey: true,   condition: () => Program?.shown, action: () => Program.scrollBy(-1) },
    { code: 'Tab',                   condition: () => Program?.shown, action: () => Program.scrollBy(+1) },
    { code: 'Home',                  condition: () => Program?.shown, action: () => Program.scrollTo(0) },
    { code: 'End',                   condition: () => Program?.shown, action: () => Program.scrollTo(-1) },
    { code: 'Enter',                 condition: () => Program?.shown, action: () => Program.openStream() },
    { code: 'Space',                 condition: () => Program?.shown, action: () => Program.openStream() },
    { code: 'Enter', shiftKey: true, condition: () => Program?.shown, action: () => Program.openStream({newTab: true}) },
    { code: 'Space', shiftKey: true, condition: () => Program?.shown, action: () => Program.openStream({newTab: true}) }
];

// Home
// End

function globalKeyEventListener(event) {
    console.log(event.code, event.isComposing, event, document.activeElement);

    // IME入力中判定
    if (event.isComposing || event.key === 'Process' || event.keyCode === 229) {
        return;
    }

    // WAI-ARIA role判定
    if (['textbox', 'searchbox', 'combobox'].includes(event.target.role)) {
        console.log('role = ' + event.target.role);
        return;
    }

    // contentEditable有効判定
    // TODO inherit(親の属性を継承)に対応する
    if (['true', 'plaintext-only'].includes(event.target.contentEditable)) {
        console.log('contentEditable = ' + event.target.contentEditable);
        return;
    }

    // ノード名判定
    // - x.comのGrokのテキストボックスにはWAI-ARIAが設定されておらず、かつkeydownイベントが伝播するため対処する
    const nodeName = event.target.nodeName.toLowerCase();
    if (['input', 'textarea'].includes(nodeName)) {
        console.log('nodeName = ' + event.target.nodeName);
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
