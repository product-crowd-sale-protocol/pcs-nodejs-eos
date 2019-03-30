'use strict'

const readline = require("readline");
const { PCSAgent,
        PCSClient,
        PCSServer,
        EOSTableAPI } = require("./pcs-nodejs-eos");

const EOS_API_URL = "https://api-kylin.eoslaomao.com:443";
const EOS_CHAIN_ID = "5fff1dae8dc8e2fc4d5b23b2c7665c97f9e9d8edf2b6485a86ba311c25639191";
const CONTRACT_NAME = "pcscoreprtcl";
const AGENT_NAME = "leohioleohio";
const NEW_AWS_API_URL = "https://85z0ywf1ol.execute-api.ap-northeast-1.amazonaws.com/secretHashing0";
const AWS_SECURITY_API_URL = "https://78qy7hxmjd.execute-api.ap-northeast-1.amazonaws.com/pcsSecurity";

const private_keys = require("./config/private_keys.json")[0];
const ACCOUNT_NAME = private_keys.account_name;
const PERMISSION_NAME = private_keys.permission_name;
const keyProvider = [private_keys.private_key];
const DEFAULT_SYMBOL = "XFIZIWO";

const eosTable = new EOSTableAPI(EOS_API_URL, CONTRACT_NAME);

const pcsClient = new PCSClient(
    keyProvider,
    EOS_API_URL,
    EOS_CHAIN_ID,
    CONTRACT_NAME,
    ACCOUNT_NAME,
    PERMISSION_NAME,
    NEW_AWS_API_URL,
    AWS_SECURITY_API_URL);

const pcsAgent = new PCSAgent(
    EOS_API_URL,
    EOS_CHAIN_ID,
    CONTRACT_NAME,
    AGENT_NAME,
    NEW_AWS_API_URL,
    AWS_SECURITY_API_URL);

const pcsServer = new PCSServer(EOS_API_URL, AWS_SECURITY_API_URL, CONTRACT_NAME);

async function getTokenTableSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);

    console.log("start getTokenTable sample");
    const row = await eosTable.getTokenTable(sym);
    console.log(row);
}

async function getAvailableTokenIdSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);

    console.log("start getAvailableTokenId sample");
    const next_token_id = await eosTable.getAvailableTokenId(sym);
    console.log(`the next available token ID with '${sym}' symbol is ${next_token_id}`);
}

async function getTokenInfoSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const token_id = await readStdin("Which token ID?", "0");

    console.log("start getTokenInfo sample");
    const row = await eosTable.getTokenInfo(sym, token_id);
    const status = (row == null)
        ? "nothing"
        : `owned by ${row.owner} and ${row.active === 0 ? "locked" : "active"}`;

    console.log(`the '${sym}' symbol token with ID #${token_id} is ${status}`);
}

async function verifyAuthSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const token_id = await readStdin("Which token ID?", "0");
    const password = await readStdin("what's current password of its token?");
    const subkey_private = await pcsServer.passwordToKey(sym, token_id, password);

    console.log("start verifyAuth sample");
    const success = await pcsServer.verifyAuth(sym, token_id, subkey_private);
    console.log(`token ${sym}#${token_id} is ${success ? "verified" : "rejected"}`);
}

async function createTokenSample() {
    console.log("start createToken sample");

    try {
        const success = await pcsClient.create();
        console.log("succeed in creating token");
    } catch (err) {
        console.log("fail to create token");
    }
}

async function issueTokenSample() {
    const receipent = await readStdin("Who do you issue new token to?", ACCOUNT_NAME);
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);

    console.log("start issueToken sample");

    try {
        const success = await pcsClient.issue(receipent, "1", sym, "issue token");
        console.log("succeed in issuing token");
    } catch (err) {
        console.log("fail to issue token");
    }
}

async function issueToAgentSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const password = await readStdin("what's password of its token?", "pass");

    console.log("start issueToAgent sample");

    try {
        const token_id = await eosTable.getAvailableTokenId(sym);
        const subkey_private = await pcsServer.passwordToKey(sym, token_id, password);
        const success = await pcsClient.issueToAgent(sym, token_id, subkey_private);
        console.log("succeed in issuing token");
    } catch (err) {
        console.log("fail to issue token");
    }
}

async function refreshKeySample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const token_id = await readStdin("Which token ID?", "0");
    const password = await readStdin("what's new password of its token?", "pass");

    console.log("start refreshKey sample");

    try {
        const new_subkey_private = await pcsServer.passwordToKey(sym, token_id, password);
        const success = await pcsClient.refreshKey(sym, token_id, new_subkey_private);
        console.log("succeed in changing subkey of given token");
    } catch (err) {
        console.log("fail to change subkey of given token");
    }
}

async function refreshKeyViaAgentSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const token_id = await readStdin("Which token ID?", "0");
    const old_password = await readStdin("what's current password of its token?");
    const new_password = await readStdin("what's new password of its token?", "pass");

    console.log("start refreshKeyViaAgent sample");

    try {
        const old_subkey_private = await pcsServer.passwordToKey(sym, token_id, old_password);
        const new_subkey_private = await pcsServer.passwordToKey(sym, token_id, new_password);
        const success = await pcsAgent.refreshKeyViaAgent(sym, token_id, old_subkey_private, new_subkey_private);
        console.log("succeed in changing subkey of given token");
    } catch (err) {
        console.log("fail to change subkey of given token");
    }
}

async function transferByIdSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const token_id = await readStdin("Which token ID?", "0");
    const receipent = await readStdin("Who do you send the token to?", ACCOUNT_NAME);

    console.log("start transferById sample");

    try {
        const success = await pcsClient.transferById(receipent, sym, token_id, "send token");
        console.log("succeed in transfering given token");
    } catch (err) {
        console.log("fail to transfer given token");
    }
}

async function transferByIdFromAgentSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const token_id = await readStdin("Which token ID?", "0");
    const receipent = await readStdin("Who do you send the token to?", ACCOUNT_NAME);
    const password = await readStdin("what's current password of its token?");

    console.log("start transferByIdFromAgent sample");

    try {
        const subkey_private = await pcsServer.passwordToKey(sym, token_id, password);
        const success = await pcsAgent.transferByIdFromAgent(receipent, sym, token_id, subkey_private);
        console.log("succeed in transfering given token");
    } catch (err) {
        console.log("fail to transfer given token");
    }
}

async function lockTokenSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const token_id = await readStdin("Which token ID?", "0");
    const password = await readStdin("what's current password of its token?");

    console.log("start lockToken sample");

    try {
        const subkey_private = await pcsServer.passwordToKey(sym, token_id, password);
        const success = await pcsClient.lock(sym, token_id, subkey_private);
        console.log("succeed in locking token");
    } catch (err) {
        console.log("fail to lock token");
    }
}

async function readStdin(question="please input some words", default_input="") {
    console.log(`${question} (default '${default_input}')`);
    const rl = readline.createInterface(process.stdin, process.stdout);
    const input = await new Promise((callback) => rl.once("line", callback));
    rl.close();

    return input || default_input;
}

async function selectCommand() {
    let sym;
    let token_id;
    let receipent;
    let password;
    let select = true;

    const cid = await readStdin("\nselect command ID:");
    switch (cid) {
        case "0":
            select = false;
            break;
        case "1":
            await getTokenTableSample();
            break;
        case "2":
            await getAvailableTokenIdSample();
            break;
        case "3":
            await getTokenInfoSample();
            break;
        case "4":
            await verifyAuthSample();
            break;
        case "10":
            await createTokenSample();
            break;
        case "11":
            await issueTokenSample();
            break;
        case "21":
            await issueToAgentSample();
            break;
        case "12":
            await transferByIdSample();
            break;
        case "13":
            await refreshKeySample();
            break;
        case "14":
            await lockTokenSample();
            break;
        case "22":
            await transferByIdFromAgentSample();
            break;
        case "23":
            await refreshKeyViaAgentSample();
            break;
        default:
            showCommandList();
            break;
    }

    return select;
}

function showCommandList() {
    console.log("ID | COMMAND NAME\n" +
                " 1   getTokenTable\n" +
                " 2   getAvailableTokenId\n" +
                " 3   getTokenInfo\n" +
                " 4   verifyAuth\n" +
                "10   createToken\n" +
                "11   issueToken\n" +
                "21   issueToAgent\n" +
                "12   transferById\n" +
                "22   transferByIdFromAgent\n" +
                "13   refreshKey\n" +
                "23   refreshKeyViaAgent\n" +
                "14   lockToken\n" +
                "     see command list\n" +
                " 0   EXIT");
}

(async function() {
    let select = true;
    showCommandList();
    while (select) {
        select = await selectCommand();
    }
    console.log("Thank you for hacking!");
})();