import React, { Component } from 'react';
import nearlogo from './assets/gray_near_logo.svg';
import './App.css';
import * as nearlib from "nearlib";
import {OpenWebApp} from './openweb.js';
import {ProfileApp} from "./profile";

const GAS = 2_000_000_000_000_000;

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      login: false,
      apps: {},
    }
    this.signedInFlow = this.signedInFlow.bind(this);
    this.requestSignIn = this.requestSignIn.bind(this);
    this.requestSignOut = this.requestSignOut.bind(this);
    this.signedOutFlow = this.signedOutFlow.bind(this);
    window.nearlib = nearlib;
  }

  componentDidMount() {
    let loggedIn = window.walletAccount.isSignedIn();
    if (loggedIn) {
      this.signedInFlow();
    } else {
      this.signedOutFlow();
    }
  }

  async signedInFlow() {
    console.log("come in sign in flow")
    const accountId = await this.props.wallet.getAccountId()
    this.setState({
      login: true,
      accountId,
    })
    if (window.location.search.includes("account_id")) {
      window.location.replace(window.location.origin + window.location.pathname)
    }
    if (window.location.search.includes("all_keys")) {
      window.location.replace(window.location.origin + window.location.pathname)
    }
    // Initializing our contract APIs by contract name and configuration.

    console.log("Connecting to account...");
    const account = await new nearlib.Account(window.near.connection, accountId);
    console.log("Querying state...");
    let state = await account.state();
    console.log(state);
    if (state.code_hash === '11111111111111111111111111111111') {
      console.log("Going to deploy the code");
      // no code. Need to deploy.
      console.log("Downloading started...");
      let data = await fetch('/open_web.wasm');
      let buf = await data.arrayBuffer();
      console.log("Downloading done. Deploying contract...");
      await account.deployContract(new Uint8Array(buf));
      console.log("Deploying done. Initializing contract...");
      // Gotta init it.
      let contract = await new nearlib.Contract(account, accountId, {
        viewMethods: [],
        // Change methods can modify the state. But you don't receive the returned value when called.
        changeMethods: ['new'],
        // Sender is the account ID to initialize transactions.
        sender: accountId
      });
      console.log(await contract.new());
      console.log("Done");
    }

    const masterContract = await new nearlib.Contract(account, accountId, {
      // View methods are read only. They don't modify the state, but usually return some value.
      viewMethods: ['apps'],
      // Change methods can modify the state. But you don't receive the returned value when called.
      changeMethods: ['add_app_key', 'remove_app_key'],
      // Sender is the account ID to initialize transactions.
      sender: accountId
    });

    this.masterContract = masterContract;
    window.masterContract = masterContract;
    console.log("Fetching authorized apps...");
    console.log("Apps:", await masterContract.apps());

    console.log("Initializing local apps...");
    const apps = {
      profile: await this.initOpenWebApp('profile', accountId),
      graph: await this.initOpenWebApp('graph', accountId),
      messages: await this.initOpenWebApp('messages', accountId),
    };
    window.apps = apps;
    this.apps = apps;
    this.setState({
      apps,
    })
    console.log(apps);
  }
/*
  async fetchValues() {
    await Promise.all([
      this.profile.get('display_name'),
    ])
  }
*/
  async initOpenWebApp(appId, accountId) {
    console.log("Initializing app: " + appId + " ...");
    const app = await new OpenWebApp(appId, accountId, window.nearConfig);
    await app.init();
    if (!await app.ready()) {
      let pk = await app.getPublicKey();
      console.log("Authorizing app for key " + pk.toString() + " ...");
      const args = {
        public_key: [...nearlib.utils.serialize.serialize(nearlib.transactions.SCHEMA, pk)],
        app_id: appId,
      };
      await this.masterContract.add_app_key(args, GAS);
      await app.onKeyAdded();
    }
    console.log("Done");
    return app;
  }

  async requestSignIn() {
    const appTitle = 'Open Web Home';
    await this.props.wallet.requestSignIn(
      "",
      appTitle
    )
  }

  requestSignOut = () => {
    this.props.wallet.signOut();
    setTimeout(this.signedOutFlow, 500);
    console.log("after sign out", this.props.wallet.isSignedIn())
  }


  signedOutFlow = () => {
    if (window.location.search.includes("account_id")) {
      window.location.replace(window.location.origin + window.location.pathname)
    }
    this.setState({
      login: false,
    })
  }

  render() {
    return (
      <div className="App-header">
        <div className="image-wrapper">
          <img className="logo" src={nearlogo} alt="NEAR logo" />
        </div>
        <h1>Hello, {this.state.accountId}</h1>
        <div>
          {this.state.login ? <button onClick={this.requestSignOut}>Log out</button>
            : <button onClick={this.requestSignIn}>Log in with NEAR</button>}
        </div>
        <br/>
        <div className="apps">
          <ProfileApp app={this.state.apps.profile}/>
        </div>
      </div>
    )
  }

}

export default App;
