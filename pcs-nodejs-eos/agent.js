'use strict'

const Eos = require("eosjs");
const ecc = require("eosjs-ecc");
const EOSTableAPI = require("./eos-table");
const PCSServer = require("./server");
const { getSigTimestamp,
        getNameValue,
        getSymbolCodeRaw,
        publicKeyToBuffer,
        uint64ToBuffer } = require("./subsig");

class PCSAgent {
    constructor(
        eos_api_url,
        eos_chain_id,
        contract_name,
        agent_name,
        new_aws_api,
        aws_security_api
    ) {
        this.contract_name = contract_name;
        this.agent_name = agent_name;
        this.eosJS = Eos({
            keyProvider: [],
            httpEndpoint: eos_api_url,
            chainId: eos_chain_id
        });
        this.eosTable = new EOSTableAPI(eos_api_url, contract_name);
        this.pcsServer = new PCSServer(new_aws_api, aws_security_api, contract_name);
    }

    /**
     * This function is only triggerd internally when transferById's agent argument is true.
     * @param {*} sym token symbol
     * @param {*} id token ID to send
     * @param {*} to recipient
     */
    async transferByIdFromAgent(to, sym, token_id, subkey_private) {
        /// check given private key is valid
        if (!ecc.isValidPrivate(subkey_private)) {
            throw new RangeError("invalid private_key format");
        }

        /// generate message for signature
        const act_bin = getNameValue("transferid2");
        const to_bin = getNameValue(to);
        const sym_bin = getSymbolCodeRaw(sym);
        const id_bin = uint64ToBuffer(token_id);
        const ts_bin = getSigTimestamp();
        const message_bin = [...act_bin, ...to_bin, ...sym_bin, ...id_bin, ...ts_bin];
        const message = Buffer(message_bin);

        /// generate signature for action data
        const sig = ecc.sign(message, subkey_private);

        /// generate query for PCS server
        const query = {
            AgentEvent: "TRANSFER",
            newAddress: to,
            symbolCode: sym,
            tokenId: String(token_id),
            signature: sig
        };
        console.log("query: ", query);

        try {
            /// via agent to sign action data
            const signed_trx = await this.pcsServer.requestSignTransaction(query);
            console.log(signed_trx);

            /// broadcast signed transaction
            return this.eosJS.pushTransaction(signed_trx);
        } catch (err) {
            throw new Error(err);
        }
    }

    /**
     * This function is only triggerd internally when transferById's agent argument is true.
     * @param {*} sym token symbol
     * @param {*} id token ID to chenge subkey
     * @param {*} password by which new subkey made
     */
    async refreshKeyViaAgent(sym, token_id, old_subkey_private, new_subkey_private) {
        /// check given private key is valid
        if (!ecc.isValidPrivate(old_subkey_private)) {
            throw new RangeError(`invalid private_key format: ${old_subkey_private}`);
        }

        if (!ecc.isValidPrivate(new_subkey_private)) {
            throw new RangeError(`invalid private_key format: ${new_subkey_private}`);
        }

        const new_subkey = ecc.privateToPublic(new_subkey_private);

        /// generate message for signature
        const act_bin = getNameValue("refreshkey2");
        const sym_bin = getSymbolCodeRaw(sym);
        const id_bin = uint64ToBuffer(token_id);
        const sk_bin = publicKeyToBuffer(new_subkey);
        const ts_bin = getSigTimestamp();
        const message_bin = [...act_bin, ...sym_bin, ...id_bin, ...sk_bin, ...ts_bin];
        const message = Buffer(message_bin);
        console.log(message);

        /// generate signature for query data
        const sig = ecc.sign(message, old_subkey_private);

        /// generate query for PCS server
        const query = {
            AgentEvent: "REFRESH",
            symbolCode: sym,
            tokenId: token_id,
            signature: sig,
            newSubKey: new_subkey
        };
        console.log("query: ", query);

        try {
            /// via agent to sign action data
            const signed_trx = await this.pcsServer.requestSignTransaction(query);
            console.log(signed_trx);

            /// broadcast signed transaction
            return this.eosJS.pushTransaction(signed_trx);
        } catch (err) {
            throw new Error(err);
        }
    }
}

module.exports = PCSAgent;
