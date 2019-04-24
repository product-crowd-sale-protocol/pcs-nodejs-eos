'use strict'

const ecc = require("eosjs-ecc");
const readline = require("readline");
const { PCSAgent,
        PCSClient,
        PCSServer,
        EOSTableAPI } = require("./pcs-nodejs-eos");
const { EOS_API_URL,
        EOS_CHAIN_ID,
        CONTRACT_NAME,
        AGENT_NAME,
        NEW_AWS_API_URL,
        AWS_SECURITY_API_URL,
        DEFAULT_SYMBOL,
        DEV_PRIVATE_KEYS } = require("./config/env_variables_kylin.json");
const dev_private_key = DEV_PRIVATE_KEYS[0];
const DEV_ACCOUNT_NAME = dev_private_key.account_name;
const DEV_PERMISSION_NAME = dev_private_key.permission_name;
const keyProvider = [dev_private_key.private_key];

const eosTable = new EOSTableAPI(EOS_API_URL, CONTRACT_NAME);

const pcsClient = new PCSClient(
    keyProvider,
    EOS_API_URL,
    EOS_CHAIN_ID,
    CONTRACT_NAME,
    DEV_ACCOUNT_NAME,
    DEV_PERMISSION_NAME,
    NEW_AWS_API_URL,
    AWS_SECURITY_API_URL);

const pcsAgent = new PCSAgent(
    EOS_API_URL,
    EOS_CHAIN_ID,
    CONTRACT_NAME,
    AGENT_NAME,
    NEW_AWS_API_URL,
    AWS_SECURITY_API_URL);

const pcsServer = new PCSServer(NEW_AWS_API_URL, AWS_SECURITY_API_URL, CONTRACT_NAME);

async function getTokenTableSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);

    console.log("start getTokenTable sample");

    try {
        const row = await eosTable.getTokenTable(sym);
        console.log(row);
    } catch (err) {
        console.error(err);
        console.error("fail to request");
    }
}

async function getAvailableTokenIdSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);

    console.log("start getAvailableTokenId sample");

    try {
        const next_token_id = await eosTable.getAvailableTokenId(sym);
        console.log(`the next available token ID with '${sym}' symbol is ${next_token_id}`);
    } catch (err) {
        console.error(err);
        console.error("fail to request");
    }
}

async function getTokenInfoSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const token_id = await readStdin("Which token ID?", "0");

    console.log("start getTokenInfo sample");

    try {
        const row = await eosTable.getTokenInfo(sym, token_id);
        const status = (row == null)
            ? "nothing"
            : `owned by ${row.owner} and ${row.active === 0 ? "locked" : "active"}`;

        console.log(`the '${sym}' symbol token with ID #${token_id} is ${status}`);
    } catch (err) {
        console.error(err);
        console.error("fail to request");
    }
}

async function verifyAuthSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const token_id = await readStdin("Which token ID?", "0");
    const password = await readStdin("what's current password of its token?");

    console.log("start verifyAuth sample");

    try {
        const subkey_private = await pcsServer.passwordToKey(sym, token_id, password);
        const success = await pcsServer.verifyAuth(sym, token_id, subkey_private);
        console.log(`token ${sym}#${token_id} is ${success ? "verified" : "rejected"}`);
    } catch (err) {
        console.error(err);
        console.error("fail to request");
    }
}

async function createTokenSample() {
    console.log("start createToken sample");

    try {
        const res = await pcsClient.create();
        console.log(res);
        console.log("succeed in creating token");
    } catch (err) {
        console.error(err);
        console.error("fail to create token");
    }
}

async function issueTokenSample() {
    const receipent = await readStdin("Who do you issue new token to?", DEV_ACCOUNT_NAME);
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);

    console.log("start issueToken sample");

    try {
        const res = await pcsClient.issue(receipent, "1", sym, "issue token");
        console.log(res);
        console.log("succeed in issuing token");
    } catch (err) {
        console.error(err);
        console.error("fail to issue token");
    }
}

async function issueToAgentSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const password = await readStdin("what's password of its token?", "pass");

    console.log("start issueToAgent sample");

    try {
        const token_id = await eosTable.getAvailableTokenId(sym);
        const subkey_private = await pcsServer.passwordToKey(sym, token_id, password);
        const res = await pcsClient.issueToAgent(sym, token_id, subkey_private);
        console.log(res);
        console.log("succeed in issuing token to agent account");
    } catch (err) {
        console.error(err);
        console.error("fail to issue token to agent account");
    }
}

async function refreshKeySample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const token_id = await readStdin("Which token ID?", "0");
    const password = await readStdin("what's new password of its token?", "pass");

    console.log("start refreshKey sample");

    try {
        const new_subkey_private = await pcsServer.passwordToKey(sym, token_id, password);
        const new_subkey = ecc.privateToPublic(new_subkey_private);
        console.log("new subkey is", new_subkey);

        const eos_auth = await this.eosTable.getEOSAuth(sym, token_id);
        const old_subkey = eos_auth.subkey;
        console.log("old subkey is", old_subkey);

        if (new_subkey === old_subkey) {
            console.log("recover private key corresponding to given token subkey");
            return;
        }

        const res = await pcsClient.refreshKey(sym, token_id, new_subkey_private);
        console.log(res);
        console.log("succeed in changing subkey of given token");
    } catch (err) {
        console.error(err);
        console.error("fail to change subkey of given token");
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
        const res = await pcsAgent.refreshKeyViaAgent(sym, token_id, old_subkey_private, new_subkey_private);
        console.log(res);
        console.log("succeed in changing subkey of given token");
    } catch (err) {
        console.error(err);
        console.error("fail to change subkey of given token");
    }
}

async function transferByIdSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const token_id = await readStdin("Which token ID?", "0");
    const receipent = await readStdin("Who do you send the token to?", DEV_ACCOUNT_NAME);

    console.log("start transferById sample");

    try {
        const res = await pcsClient.transferById(receipent, sym, token_id, "send token");
        console.log(res);
        console.log("succeed in transfering given token");
    } catch (err) {
        console.error(err);
        console.error("fail to transfer given token");
    }
}

async function transferByIdFromAgentSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const token_id = await readStdin("Which token ID?", "0");
    const receipent = await readStdin("Who do you send the token to?", DEV_ACCOUNT_NAME);
    const password = await readStdin("what's current password of its token?");

    console.log("start transferByIdFromAgent sample");

    try {
        const subkey_private = await pcsServer.passwordToKey(sym, token_id, password);
        const res = await pcsAgent.transferByIdFromAgent(receipent, sym, token_id, subkey_private);
        console.log(res);
        console.log("succeed in transfering given token");
    } catch (err) {
        console.error(err);
        console.error("fail to transfer given token");
    }
}

async function lockTokenSample() {
    const sym = await readStdin("Which token symbol?", DEFAULT_SYMBOL);
    const token_id = await readStdin("Which token ID?", "0");
    const password = await readStdin("what's current password of its token?");

    console.log("start lockToken sample");

    try {
        const subkey_private = await pcsServer.passwordToKey(sym, token_id, password);
        const res = await pcsClient.lock(sym, token_id, subkey_private);
        console.log(res);
        console.log("succeed in locking token");
    } catch (err) {
        console.error(err);
        console.error("fail to lock token");
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
