'use strict'

const Eos = require("eosjs");
const ecc = require("eosjs-ecc");
const EOSTableAPI = require("./eos-table");
const PCSServer = require("./server");
const { getSigTimestamp,
        getNameValue,
        getSymbolCodeRaw,
        uint64ToBuffer,
        stringToBuffer } = require("./subsig");


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
                throw new Error(`given symbol '${sym}' has already been used`);
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

        return this.eosJS.transaction({actions});
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

        return this.eosJS.transaction({actions});
    }

    /**
     * issue to agent account
     * @param {string} sym token symbol
     * @param {string} token_id available token ID
     * @param {string} password for generating subkey
     * @param {string} memo - Data that can be written as the user likes.
     */
    async issueToAgent(sym, token_id, subkey_private, memo="issue token to agent account") {
        /// check given private key is valid
        if (!ecc.isValidPrivate(subkey_private)) {
            throw new RangeError(`invalid private_key format: ${subkey_private}`);
        }

        const subkey = ecc.privateToPublic(subkey_private);
        const action = {
            account: this.contract_name,
            name: "issuetoagent",
            authorization: [this.account],
            data: {sym, token_id, subkey, memo}
        };
        const actions = [action];
        console.log(actions);

        return this.eosJS.transaction({actions});
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

        return this.eosJS.transaction({actions});
    }

    /**
     * Refresh token subsig public key in EOS table and set new subsig private key into local storage.
     * @param {string} sym community symbol
     * @param {string} token_id nft id
     * @param {string} new_subkey_private private key corresponding to new subkey
     */
    async refreshKey(sym, token_id, new_subkey_private) {
        /// check given private key is valid
        if (!ecc.isValidPrivate(new_subkey_private)) {
            throw new RangeError(`invalid private_key format: ${new_subkey_private}`);
        }

        const new_subkey = ecc.privateToPublic(new_subkey_private);
        const action = {
            account: this.contract_name,
            name: "refreshkey",
            authorization: [this.account],
            data: { sym, token_id, new_subkey },
        };
        const actions = [action];
        console.log(actions);

        return this.eosJS.transaction({actions});
    }


    /**
     * This function is only triggerd internally when transferById's agent argument is true.
     * @param {string} sym token symbol
     * @param {number} token_id token ID to chenge subkey
     * @param {string} subkey_private private key corresponding to the subkey of token to lock
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
        const message = Buffer.from(message_bin);
        const sig = ecc.sign(message, subkey_private);
        const action = {
            account: this.contract_name,
            name: "lock",
            authorization: [this.account],
            data: {sym, token_id, sig}
        };
        const actions = [action];
        console.log(actions);

        return this.eosJS.transaction({actions});
    }

    /**
     * @param {string} sym token symbol
     * @param {number} token_id token ID to chenge subkey
     * @param {string} meta_str written in token meta data
     * @param {string} subkey_private private key corresponding to the subkey of token to set meta data
     */
    async setmeta(sym, token_id, meta_str, subkey_private) {
        /// check given private key is valid
        if (!ecc.isValidPrivate(subkey_private)) {
            throw new RangeError(`invalid private_key format: ${subkey_private}`);
        }

        const act_bin = getNameValue("setmeta");
        const sym_bin = getSymbolCodeRaw(sym);
        const id_bin = uint64ToBuffer(token_id);
        const meta_bin = stringToBuffer(meta_str);
        const ts_bin = getSigTimestamp();
        const message_bin = [...act_bin, ...sym_bin, ...id_bin, ...meta_bin, ...ts_bin];
        console.log("message_bin:", "[ " + message_bin.join(", ") + " ]");
        const message = Buffer.from(message_bin);
        const sig = ecc.sign(message, subkey_private);
        const action = {
            account: this.contract_name,
            name: "setmeta",
            authorization: [this.account],
            data: {sym, token_id, meta_str, sig}
        };
        const actions = [action];
        console.log(actions);

        return this.eosJS.transaction({actions});
    }
}

module.exports = PCSClient;
