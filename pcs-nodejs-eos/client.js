'use strict'

const Eos = require("eosjs");
const ecc = require("eosjs-ecc");
const EOSTableAPI = require("./eos-table");
const PCSServer = require("./server");
const { getSigTimestamp,
        getNameValue,
        getSymbolCodeRaw,
        uint64ToBuffer } = require("./subsig");


class PCSClient {
    constructor(
        private_keys,
        eos_api_url,
        eos_chain_id,
        contract_name,
        account_name,
        account_authority,
        new_aws_api,
        aws_security_api
    ) {
        this.contract_name = contract_name;
        this.account = {
            actor: account_name,
            permission: account_authority,
        };

        this.eosJS = Eos({
            keyProvider: private_keys,
            httpEndpoint: eos_api_url,
            chainId: eos_chain_id
        });
        this.eosTable = new EOSTableAPI(eos_api_url, contract_name);
    }

    /**
     * Create new PCS Token. Only contract-deployer or 'issuer' execute this.
     * @param {string} sym - the symbol name of token to create
     */
    async create(sym) {
        if (sym) {
            const exists = await this.eosTable.existSymbol(sym);
            if (exists) {
                console.error(`given symbol '${sym}' has already been used`);
                return false;
            }
        } else {
            let exists = true;
            const pickUppercase = () => {
                return String.fromCharCode(Math.floor(Math.random() * 26) + 65);
            };

            do {
                sym = "X" + Array.from({length: 6}, pickUppercase).join("");
                exists = await this.eosTable.existSymbol(sym);
            } while (exists);
        }

        console.log(`create new symbol '${sym}'`);

        const actor = this.account.actor;
        const issuer = this.account.actor;
        const action = {
            account: this.contract_name,
            name: "create",
            authorization: [this.account],
            data: { actor, issuer, sym },
        };
        const actions = [action];
        console.log(actions);

        try {
            const res = await this.eosJS.transaction({actions});
            console.log(res);
        } catch (err) {
            console.error(err);
            return false;
        }

        return true;
    }

    /**
     * Issue a PCS token. This method fails if the token has not been created.
     * If you issue to agent account, please use issuetoagent action
     * @param {string} user - Account to receive issued token
     * @param {string} amount - How much issue to user
     * @param {string} sym - what token symbol issue to user.
     * @param {string} memo - Data that can be written as the user likes.
     */
    async issue(user, amount, sym, memo="issue token") {
        const quantity = String(Math.floor(amount)) + " " + sym;
        const action = {
            account: this.contract_name,
            name: "issue",
            authorization: [this.account],
            data: { user, quantity, memo },
        };
        const actions = [action];
        console.log(actions);

        try {
            const res = await this.eosJS.transaction({actions});
            console.log(res);
        } catch (err) {
            console.error(err);
            return false;
        }

        return true;
    }

    /**
     * issue to agent account
     * @param {string} sym token symbol
     * @param {string} password for generating subkey
     * @param {string} memo - Data that can be written as the user likes.
     */
    async issueToAgent(sym, token_id, subkey_private, memo="issue token to agent account") {
        const subkey = ecc.privateToPublic(subkey_private);
        const action = {
            account: this.contract_name,
            name: "issuetoagent",
            authorization: [{
                actor: this.account.actor,
                permission: "active"
            }],
            data: {sym, token_id, subkey, memo}
        };
        const actions = [action];
        console.log(actions);

        try {
            const res = await this.eosJS.transaction({actions});
            console.log(res);
        } catch (err) {
            console.error(err);
            return false;
        }

        console.log("succeed in issuing token to agent account");
        return true;
    }

    /**
     * transfer PCS Token to recipient.
     * @param {string} to token recipient
     * @param {string} sym token symbol
     * @param {string} token_id token ID to send
     * @param {string} memo - Data that can be written as the user likes.
     */
    async transferById(to, sym, token_id, memo="send token") {
        const from = this.account.actor;
        const action = {
            account: this.contract_name,
            name: "transferbyid",
            authorization: [this.account],
            data: { from, to, sym, token_id, memo },
        };
        const actions = [action];
        console.log(actions);

        try {
            const res = await this.eosJS.transaction({actions});
            console.log(res);
        } catch (err) {
            console.error(err);
            return false;
        }

        console.log("succeed in transfering given token");
        return true;
    }

    /**
     * Refresh token subsig public key in EOS table and set new subsig private key into local storage.
     * @param {string} password new password to generate subsig key pair
     * @param {string} sym community symbol
     * @param {string} token_id nft id
     */
    async refreshKey(sym, token_id, old_subkey, new_subkey_private) {
        console.log("old subkey is", old_subkey);

        const new_subkey = ecc.privateToPublic(new_subkey_private);
        console.log("new subkey is", new_subkey);

        const eos_auth = await this.eosTable.getEOSAuth(sym, token_id);
        const old_subkey = eos_auth.subkey;

        if (new_subkey === old_subkey) {
            console.log("recover private key corresponding to given token subkey");
            return true;
        }

        const action = {
            account: this.contract_name,
            name: "refreshkey",
            authorization: [this.account],
            data: { sym, token_id, new_subkey },
        };
        const actions = [action];
        console.log(actions);

        try {
            const res = await this.eosJS.transaction({actions});
            console.log(res);
        } catch (err) {
            console.error(err);
            return false;
        }

        return true;
    }


    /**
     * This function is only triggerd internally when transferById's agent argument is true.
     * @param {*} sym token symbol
     * @param {*} token_id token ID to chenge subkey
     * @param {*} subkey_private private key corresponding to the subkey of token to lock
     */
    async lock(sym, token_id, subkey_private) {
        /// check given private key is valid
        if (!ecc.isValidPrivate(subkey_private)) {
            throw new RangeError(`invalid private_key format: ${subkey_private}`);
        }

        const act_bin = getNameValue("lock");
        const sym_bin = getSymbolCodeRaw(sym);
        const id_bin = uint64ToBuffer(token_id);
        const ts_bin = getSigTimestamp();
        const message_bin = [...act_bin, ...sym_bin, ...id_bin, ...ts_bin];
        console.log("message_bin:", "[ " + message_bin.join(", ") + " ]");
        console.log("message_bin size:", message_bin.length);
        const message = Buffer(message_bin);
        const sig = ecc.sign(message, subkey_private);
        console.log("sig:", sig);

        const action = {
            account: this.contract_name,
            name: "lock",
            authorization: [this.account],
            data: {sym, token_id, sig}
        };
        const actions = [action];
        console.log(actions);

        try {
            const res = await this.eosJS.transaction({actions});
            console.log(res);
        } catch (err) {
            console.error(err);
            return false;
        }

        console.log("succeed in locking token");
        return true;
    }
}

module.exports = PCSClient;
