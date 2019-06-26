import * as React from "react";
import { render } from "react-dom";

type AppProps = {};
type AppState = {};

class App extends React.Component<AppProps, AppState> {
  render() {
    return (
      <div>
        Hello World
      </div>
    );
  }
}


render(<App />, document.getElementById("root"));
