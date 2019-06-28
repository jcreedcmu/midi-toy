// inspired by https://twitter.com/luqui/status/1136488168436506624

import * as React from 'react';
import { render } from 'react-dom';
import { produce } from 'immer';

type Interval = { t: number };
type Note = { p: number };
type AppProps = {};
type AppState = {
  playedInterval: Note[],
  playedIntervalSize: number | undefined,
  mistake: boolean,
  remainingInput: Note[],
  right: number[],
  wrong: number[],
};

async function aeach<T>(list: T[], k: (x: T) => Promise<void>) {
  for (const x of list) {
    await k(x);
  }
}

function delay(seconds: number): Promise<void> {
  return new Promise((res, rej) => {
    setTimeout(res, seconds * 1000);
  });
}

function generateRandomNote(s: AppState): AppState {
  return produce(s, s => {
    const interval = Math.floor(Math.random() * 12) + 1;
    const pitch1 = Math.random() < 0.5 ? 0x3c : 0x35;
    s.mistake = false;
    s.remainingInput = [{ p: pitch1 }, { p: pitch1 + interval }];
    s.playedInterval = [{ p: pitch1 }, { p: pitch1 + interval }];
    s.playedIntervalSize = interval;
  });
}

function hex(x: number): string {
  return x.toString(16);
}

function range(n: number): number[] {
  const rv: number[] = [];
  for (let i = 0; i < n; i++) {
    rv.push(i);
  }
  return rv;
}

class App extends React.Component<AppProps, AppState> {
  outPort: WebMidi.MIDIOutput | undefined;


  constructor(p: AppProps) {
    super(p);
    const state = {
      playedInterval: [],
      playedIntervalSize: undefined,
      mistake: false,
      remainingInput: [],
      right: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      wrong: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };
    if (localStorage['score'] != undefined) {
      const j: { right: number[], wrong: number[] } = JSON.parse(localStorage['score']);
      state.right = j.right;
      state.wrong = j.wrong;
    }
    this.state = state;
  }

  render() {
    const s = this.state;
    let uiclass: string | undefined = undefined;
    if (s.mistake)
      uiclass = "wrong";
    else if (s.remainingInput.length == 0)
      uiclass = "right";
    const rows = [undefined, s.right, s.wrong].map((table, rowi) => {
      const cells = range(12).map((p, pi) => {
        if (table == undefined)
          return <td key={`tr${rowi}td${pi}`}><b>{p + 1}</b></td>;
        else
          return <td key={`tr${rowi}td${pi}`}>{table[p + 1] || 0}</td>;
      });
      return <tr key={`tr${rowi}`}>{cells}</tr>;
    });
    const scoreTable = <table><tbody>{rows}</tbody></table>;
    return (
      <div id="ui" className={uiclass}>
        {s.playedIntervalSize}< br />
        {JSON.stringify(s.remainingInput.map(x => x.p))}
        {scoreTable}
      </div>
    );
  }
  componentDidMount() {
    navigator.requestMIDIAccess().then(
      (acc) => {
        for (const port of acc.outputs.values()) {
          if (!port.name!.match(/through/i)) {
            console.log(port);
            this.outPort = port;
          }
        }
        let inPort: WebMidi.MIDIInput | undefined;
        for (const port of acc.inputs.values()) {
          if (!port.name!.match(/through/i)) {
            console.log(port);
            inPort = port;
          }
        }
        inPort!.onmidimessage = this._handleMidi.bind(this);
      });


    document.addEventListener('keydown', this._handleKeyDown.bind(this));
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this._handleKeyDown.bind(this));
  }

  _scoreLastProblem(): void {
    function incr(table: { [x: number]: number }, i: number) {
      if (table[i] == undefined)
        table[i] = 0;
      table[i]++;
    }
    this.setState(s => produce(s, s => {
      const i = s.playedIntervalSize;
      if (i != undefined) {
        incr(s.mistake ? s.wrong : s.right, i);
      }
    }));
    const j = { right: this.state.right, wrong: this.state.wrong };
    localStorage['score'] = JSON.stringify(j);
  }

  _handleMidi(m: WebMidi.MIDIMessageEvent) {
    const { data } = m;
    if (data[0] == 0x90 && data[2] > 0) {
      if (data[1] == 24) {
        this.replaySoon();
        return;
      }
      if (this.state.remainingInput.length > 0) {
        this.setState(s => produce(s, s => {
          if (data[1] == s.remainingInput[0].p) {
            s.remainingInput.shift();
          }
          else {
            s.mistake = true;
          }
        }));
        if (this.state.remainingInput.length == 0) {
          this._scoreLastProblem();
          this.newProblemSoon(this.state.mistake);
        }
      }
    }
  }

  async playNote(pitch: number) {
    this.outPort!.send([0x90, pitch, 0x28]);
    await delay(0.2);
    this.outPort!.send([0x80, pitch, 0x00]);
    await delay(0.1);
  }

  async replaySoon(): Promise<void> {
    await delay(0.5);
    this.play();
  }

  async newProblemSoon(mistake: boolean): Promise<void> {
    await delay(0.5);
    if (mistake) {
      [30].forEach(p => this.playNote(p));
    }
    else {
      [60, 64, 67, 72].forEach(p => this.playNote(p));
    }
    await delay(1);
    this.newProblem();
  }

  newProblem(): void {
    this.setState(s => generateRandomNote(s));
    this.play();
  }

  _handleKeyDown(e: KeyboardEvent) {
    if (e.keyCode == 32) {
      this.newProblem();
    }
    if (e.keyCode == 82 && !e.ctrlKey) {
      this.play();
    }
    console.log(e.keyCode);
  }

  async play(): Promise<void> {
    for (const n of this.state.playedInterval) {
      await this.playNote(n.p);
    }
  }
}

render(<App />, document.getElementById('root'));
