import { fetch } from "./http";
export const getVlessEncAuthBlocks = async () => {
    return fetch("/xray/vlessenc");
};
export const generateRealityKeypair = async () => {
    return fetch("/xray/reality-keypair");
};
export const generateRealityShortId = async () => {
    return fetch("/xray/reality-shortid");
};
export const generateEchCert = async (sni) => {
    return fetch("/xray/ech", { query: { sni } });
};
export const generateOVSelfSigned = async () => {
    return fetch("/xray/ov-self-signed");
};
export const generateAnyConnectSelfSigned = async (names) => {
    const query = new URLSearchParams();
    for (const name of names)
        query.append("name", name);
    return fetch(`/xray/anyconnect-self-signed?${query.toString()}`);
};
export const generateWGKeypair = async () => {
    return fetch("/xray/wg-keypair");
};
export const generateMldsa65 = async () => {
    return fetch("/xray/mldsa65");
};
