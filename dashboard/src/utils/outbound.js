// @ts-nocheck
const normalizeBase64 = (value) => value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
const base64Decode = (value) => {
    if (typeof value !== "string" || value.length === 0)
        return "";
    try {
        if (typeof atob === "function") {
            return atob(normalizeBase64(value));
        }
    }
    catch {
        // Ignore decoding errors; caller will handle invalid inputs.
    }
    return "";
};
const _base64Encode = (value) => {
    if (typeof value !== "string")
        return "";
    try {
        if (typeof btoa === "function") {
            return btoa(value);
        }
    }
    catch {
        // Ignore encoding errors.
    }
    return "";
};
const tryGetWireguardPublicKey = (secretKey) => {
    if (typeof secretKey !== "string" || secretKey.length === 0)
        return "";
    const globalWireguard = globalThis.Wireguard;
    if (globalWireguard?.generateKeypair) {
        try {
            const result = globalWireguard.generateKeypair(secretKey);
            if (result && typeof result.publicKey === "string") {
                return result.publicKey;
            }
        }
        catch {
            // Swallow errors; returning empty string keeps UI responsive.
        }
    }
    return "";
};
class ObjectUtil {
    static isEmpty(value) {
        if (value === null || value === undefined)
            return true;
        if (typeof value === "string")
            return value.trim().length === 0;
        if (Array.isArray(value))
            return value.length === 0;
        if (typeof value === "object")
            return Object.keys(value).length === 0;
        return false;
    }
    static isArrEmpty(value) {
        return !Array.isArray(value) || value.length === 0;
    }
}
export const Protocols = Object.freeze({
    Freedom: "freedom",
    Blackhole: "blackhole",
    DNS: "dns",
    VMess: "vmess",
    VLESS: "vless",
    Trojan: "trojan",
    Shadowsocks: "shadowsocks",
    Hysteria: "hysteria",
    Socks: "socks",
    HTTP: "http",
    Wireguard: "wireguard",
});
export const SSMethods = Object.freeze({
    AES_256_GCM: "aes-256-gcm",
    AES_128_GCM: "aes-128-gcm",
    CHACHA20_POLY1305: "chacha20-poly1305",
    CHACHA20_IETF_POLY1305: "chacha20-ietf-poly1305",
    XCHACHA20_POLY1305: "xchacha20-poly1305",
    XCHACHA20_IETF_POLY1305: "xchacha20-ietf-poly1305",
    BLAKE3_AES_128_GCM: "2022-blake3-aes-128-gcm",
    BLAKE3_AES_256_GCM: "2022-blake3-aes-256-gcm",
    BLAKE3_CHACHA20_POLY1305: "2022-blake3-chacha20-poly1305",
});
export const TLS_FLOW_CONTROL = Object.freeze({
    VISION: "xtls-rprx-vision",
    VISION_UDP443: "xtls-rprx-vision-udp443",
});
export const UTLS_FINGERPRINT = Object.freeze({
    UTLS_CHROME: "chrome",
    UTLS_FIREFOX: "firefox",
    UTLS_SAFARI: "safari",
    UTLS_IOS: "ios",
    UTLS_android: "android",
    UTLS_EDGE: "edge",
    UTLS_360: "360",
    UTLS_QQ: "qq",
    UTLS_RANDOM: "random",
    UTLS_RANDOMIZED: "randomized",
    UTLS_RONDOMIZEDNOALPN: "randomizednoalpn",
    UTLS_UNSAFE: "unsafe",
});
export const ALPN_OPTION = Object.freeze({
    H3: "h3",
    H2: "h2",
    HTTP1: "http/1.1",
});
export const OutboundDomainStrategies = Object.freeze([
    "AsIs",
    "UseIP",
    "UseIPv4",
    "UseIPv6",
    "UseIPv6v4",
    "UseIPv4v6",
    "ForceIP",
    "ForceIPv6v4",
    "ForceIPv6",
    "ForceIPv4v6",
    "ForceIPv4",
]);
export const WireguardDomainStrategy = Object.freeze([
    "ForceIP",
    "ForceIPv4",
    "ForceIPv4v6",
    "ForceIPv6",
    "ForceIPv6v4",
]);
export const USERS_SECURITY = Object.freeze({
    AES_128_GCM: "aes-128-gcm",
    CHACHA20_POLY1305: "chacha20-poly1305",
    AUTO: "auto",
    NONE: "none",
    ZERO: "zero",
});
export const MODE_OPTION = Object.freeze({
    AUTO: "auto",
    PACKET_UP: "packet-up",
    STREAM_UP: "stream-up",
    STREAM_ONE: "stream-one",
});
export const Address_Port_Strategy = Object.freeze({
    NONE: "none",
    SrvPortOnly: "srvportonly",
    SrvAddressOnly: "srvaddressonly",
    SrvPortAndAddress: "srvportandaddress",
    TxtPortOnly: "txtportonly",
    TxtAddressOnly: "txtaddressonly",
    TxtPortAndAddress: "txtportandaddress",
});
export class CommonClass {
    static toJsonArray(arr) {
        return arr.map((obj) => obj.toJson());
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static fromJson(_json) {
        return new CommonClass();
    }
    toJson() {
        return {};
    }
    toString(format = true) {
        const json = this.toJson();
        return format ? JSON.stringify(json, null, 2) : JSON.stringify(json);
    }
}
export class TcpStreamSettings extends CommonClass {
    type;
    host;
    path;
    constructor(type = "none", host = "", path = "") {
        super();
        this.type = type;
        this.host = host;
        this.path = path;
    }
    static fromJson(json = {}) {
        const header = json?.header;
        if (!header)
            return new TcpStreamSettings();
        if (header.type === "http" && header.request) {
            const host = header.request?.headers?.Host &&
                Array.isArray(header.request.headers.Host)
                ? header.request.headers.Host.join(",")
                : (header.request?.headers?.Host ?? "");
            const path = header.request?.path && Array.isArray(header.request.path)
                ? header.request.path.join(",")
                : (header.request?.path ?? "");
            return new TcpStreamSettings(header.type ?? "http", host, path);
        }
        return new TcpStreamSettings(header.type ?? "none", "", "");
    }
    toJson() {
        return {
            header: {
                type: this.type,
                request: this.type === "http"
                    ? {
                        headers: {
                            Host: ObjectUtil.isEmpty(this.host)
                                ? []
                                : this.host.split(","),
                        },
                        path: ObjectUtil.isEmpty(this.path)
                            ? ["/"]
                            : this.path.split(","),
                    }
                    : undefined,
            },
        };
    }
}
export class KcpStreamSettings extends CommonClass {
    mtu;
    tti;
    upCap;
    downCap;
    congestion;
    readBuffer;
    writeBuffer;
    type;
    seed;
    constructor(mtu = 1350, tti = 50, uplinkCapacity = 5, downlinkCapacity = 20, congestion = false, readBufferSize = 2, writeBufferSize = 2, type = "none", seed = "") {
        super();
        this.mtu = mtu ?? 1350;
        this.tti = tti ?? 50;
        this.upCap = uplinkCapacity ?? 5;
        this.downCap = downlinkCapacity ?? 20;
        this.congestion = Boolean(congestion);
        this.readBuffer = readBufferSize ?? 2;
        this.writeBuffer = writeBufferSize ?? 2;
        this.type = type ?? "none";
        this.seed = seed ?? "";
    }
    static fromJson(json = {}) {
        return new KcpStreamSettings(json?.mtu, json?.tti, json?.uplinkCapacity, json?.downlinkCapacity, json?.congestion, json?.readBufferSize, json?.writeBufferSize, json?.header?.type ?? "none", json?.seed ?? "");
    }
    toJson() {
        return {
            mtu: this.mtu,
            tti: this.tti,
            uplinkCapacity: this.upCap,
            downlinkCapacity: this.downCap,
            congestion: this.congestion,
            readBufferSize: this.readBuffer,
            writeBufferSize: this.writeBuffer,
            header: {
                type: this.type,
            },
            seed: this.seed,
        };
    }
}
export class WsStreamSettings extends CommonClass {
    path;
    host;
    heartbeatPeriod;
    constructor(path = "/", host = "", heartbeatPeriod = 0) {
        super();
        this.path = path ?? "/";
        this.host = host ?? "";
        this.heartbeatPeriod = heartbeatPeriod ?? 0;
    }
    static fromJson(json = {}) {
        return new WsStreamSettings(json?.path ?? "/", json?.host ?? "", json?.heartbeatPeriod ?? 0);
    }
    toJson() {
        return {
            path: this.path,
            host: this.host,
            heartbeatPeriod: this.heartbeatPeriod,
        };
    }
}
export class GrpcStreamSettings extends CommonClass {
    serviceName;
    authority;
    multiMode;
    constructor(serviceName = "", authority = "", multiMode = false) {
        super();
        this.serviceName = serviceName ?? "";
        this.authority = authority ?? "";
        this.multiMode = Boolean(multiMode);
    }
    static fromJson(json = {}) {
        return new GrpcStreamSettings(json?.serviceName ?? "", json?.authority ?? "", Boolean(json?.multiMode));
    }
    toJson() {
        return {
            serviceName: this.serviceName,
            authority: this.authority,
            multiMode: this.multiMode,
        };
    }
}
export class HttpUpgradeStreamSettings extends CommonClass {
    path;
    host;
    constructor(path = "/", host = "") {
        super();
        this.path = path ?? "/";
        this.host = host ?? "";
    }
    static fromJson(json = {}) {
        return new HttpUpgradeStreamSettings(json?.path ?? "/", json?.host ?? "");
    }
    toJson() {
        return {
            path: this.path,
            host: this.host,
        };
    }
}
export class XHTTPStreamSettings extends CommonClass {
    path;
    host;
    mode;
    noGRPCHeader;
    scMinPostsIntervalMs;
    xmux;
    constructor(path = "/", host = "", mode = "", noGRPCHeader = false, scMinPostsIntervalMs = "30", xmux = {
        maxConcurrency: "16-32",
        maxConnections: 0,
        cMaxReuseTimes: 0,
        hMaxRequestTimes: "600-900",
        hMaxReusableSecs: "1800-3000",
        hKeepAlivePeriod: 0,
    }) {
        super();
        this.path = path ?? "/";
        this.host = host ?? "";
        this.mode = mode ?? "";
        this.noGRPCHeader = Boolean(noGRPCHeader);
        this.scMinPostsIntervalMs = scMinPostsIntervalMs ?? "30";
        this.xmux = {
            maxConcurrency: xmux?.maxConcurrency ?? "16-32",
            maxConnections: xmux?.maxConnections ?? 0,
            cMaxReuseTimes: xmux?.cMaxReuseTimes ?? 0,
            hMaxRequestTimes: xmux?.hMaxRequestTimes ?? "600-900",
            hMaxReusableSecs: xmux?.hMaxReusableSecs ?? "1800-3000",
            hKeepAlivePeriod: xmux?.hKeepAlivePeriod ?? 0,
        };
    }
    static fromJson(json = {}) {
        return new XHTTPStreamSettings(json?.path ?? "/", json?.host ?? "", json?.mode ?? "", Boolean(json?.noGRPCHeader), json?.scMinPostsIntervalMs ?? "30", json?.xmux);
    }
    toJson() {
        return {
            path: this.path,
            host: this.host,
            mode: this.mode,
            noGRPCHeader: this.noGRPCHeader,
            scMinPostsIntervalMs: this.scMinPostsIntervalMs,
            xmux: {
                maxConcurrency: this.xmux.maxConcurrency,
                maxConnections: this.xmux.maxConnections,
                cMaxReuseTimes: this.xmux.cMaxReuseTimes,
                hMaxRequestTimes: this.xmux.hMaxRequestTimes,
                hMaxReusableSecs: this.xmux.hMaxReusableSecs,
                hKeepAlivePeriod: this.xmux.hKeepAlivePeriod,
            },
        };
    }
}
export class TlsStreamSettings extends CommonClass {
    serverName;
    alpn;
    fingerprint;
    echConfigList;
    pinnedPeerCertSha256;
    verifyPeerCertByName;
    constructor(serverName = "", alpn = [], fingerprint = "", echConfigList = "", pinnedPeerCertSha256 = "", verifyPeerCertByName = "") {
        super();
        this.serverName = serverName ?? "";
        this.alpn = alpn ?? [];
        this.fingerprint = fingerprint ?? "";
        this.echConfigList = echConfigList ?? "";
        this.pinnedPeerCertSha256 = pinnedPeerCertSha256 ?? "";
        this.verifyPeerCertByName = verifyPeerCertByName ?? "";
    }
    static fromJson(json = {}) {
        return new TlsStreamSettings(json?.serverName ?? "", Array.isArray(json?.alpn) ? json.alpn : [], json?.fingerprint ?? "", json?.echConfigList ?? "", json?.pinnedPeerCertSha256 ?? "", json?.verifyPeerCertByName ?? "");
    }
    toJson() {
        return {
            serverName: this.serverName || undefined,
            alpn: this.alpn?.length ? this.alpn : undefined,
            fingerprint: this.fingerprint || undefined,
            echConfigList: this.echConfigList || undefined,
            pinnedPeerCertSha256: this.pinnedPeerCertSha256 || undefined,
            verifyPeerCertByName: this.verifyPeerCertByName || undefined,
        };
    }
}
export class RealityStreamSettings extends CommonClass {
    publicKey;
    fingerprint;
    serverName;
    shortId;
    spiderX;
    mldsa65Verify;
    constructor(publicKey = "", fingerprint = "", serverName = "", shortId = "", spiderX = "", mldsa65Verify = "") {
        super();
        this.publicKey = publicKey ?? "";
        this.fingerprint = fingerprint ?? "";
        this.serverName = serverName ?? "";
        this.shortId = shortId ?? "";
        this.spiderX = spiderX ?? "";
        this.mldsa65Verify = mldsa65Verify ?? "";
    }
    static fromJson(json = {}) {
        return new RealityStreamSettings(json?.publicKey ?? "", json?.fingerprint ?? "", json?.serverName ?? "", json?.shortId ?? "", json?.spiderX ?? "", json?.mldsa65Verify ?? "");
    }
    toJson() {
        return {
            publicKey: this.publicKey || undefined,
            fingerprint: this.fingerprint || undefined,
            serverName: this.serverName || undefined,
            shortId: this.shortId || undefined,
            spiderX: this.spiderX || undefined,
            mldsa65Verify: this.mldsa65Verify || undefined,
        };
    }
}
export class SockoptStreamSettings extends CommonClass {
    dialerProxy;
    tcpFastOpen;
    tcpKeepAliveInterval;
    tcpMptcp;
    penetrate;
    addressPortStrategy;
    constructor(dialerProxy = "", tcpFastOpen = false, tcpKeepAliveInterval = 0, tcpMptcp = false, penetrate = false, addressPortStrategy = Address_Port_Strategy.NONE) {
        super();
        this.dialerProxy = dialerProxy ?? "";
        this.tcpFastOpen = Boolean(tcpFastOpen);
        this.tcpKeepAliveInterval = tcpKeepAliveInterval ?? 0;
        this.tcpMptcp = Boolean(tcpMptcp);
        this.penetrate = Boolean(penetrate);
        this.addressPortStrategy =
            addressPortStrategy ?? Address_Port_Strategy.NONE;
    }
    static fromJson(json = {}) {
        if (!json || Object.keys(json).length === 0) {
            return new SockoptStreamSettings();
        }
        return new SockoptStreamSettings(json?.dialerProxy ?? "", Boolean(json?.tcpFastOpen), json?.tcpKeepAliveInterval ?? 0, Boolean(json?.tcpMptcp), Boolean(json?.penetrate), json?.addressPortStrategy ?? Address_Port_Strategy.NONE);
    }
    toJson() {
        return {
            dialerProxy: this.dialerProxy || undefined,
            tcpFastOpen: this.tcpFastOpen,
            tcpKeepAliveInterval: this.tcpKeepAliveInterval || undefined,
            tcpMptcp: this.tcpMptcp,
            penetrate: this.penetrate,
            addressPortStrategy: this.addressPortStrategy,
        };
    }
}
export class HysteriaStreamSettings extends CommonClass {
    version;
    auth;
    udpIdleTimeout;
    masquerade;
    constructor(version = 2, auth = "", udpIdleTimeout = 60, masquerade) {
        super();
        this.version = Number(version) || 2;
        this.auth = auth ?? "";
        this.udpIdleTimeout = Number(udpIdleTimeout) || 60;
        this.masquerade = masquerade;
    }
    static fromJson(json = {}) {
        return new HysteriaStreamSettings(json?.version ?? 2, json?.auth ?? "", json?.udpIdleTimeout ?? 60, json?.masquerade);
    }
    toJson() {
        return {
            version: this.version || 2,
            auth: ObjectUtil.isEmpty(this.auth) ? undefined : this.auth,
            udpIdleTimeout: this.udpIdleTimeout || 60,
            masquerade: this.masquerade && Object.keys(this.masquerade).length
                ? this.masquerade
                : undefined,
        };
    }
}
export class StreamSettings extends CommonClass {
    network;
    security;
    tls;
    reality;
    tcp;
    kcp;
    ws;
    grpc;
    httpupgrade;
    xhttp;
    hysteria;
    sockopt;
    constructor(network = "tcp", security = "none", tlsSettings = new TlsStreamSettings(), realitySettings = new RealityStreamSettings(), tcpSettings = new TcpStreamSettings(), kcpSettings = new KcpStreamSettings(), wsSettings = new WsStreamSettings(), grpcSettings = new GrpcStreamSettings(), httpupgradeSettings = new HttpUpgradeStreamSettings(), xhttpSettings = new XHTTPStreamSettings(), hysteriaSettings = new HysteriaStreamSettings(), sockopt) {
        super();
        this.network = network ?? "tcp";
        this.security = security ?? "none";
        this.tls = tlsSettings;
        this.reality = realitySettings;
        this.tcp = tcpSettings;
        this.kcp = kcpSettings;
        this.ws = wsSettings;
        this.grpc = grpcSettings;
        this.httpupgrade = httpupgradeSettings;
        this.xhttp = xhttpSettings;
        this.hysteria = hysteriaSettings;
        this.sockopt = sockopt;
    }
    get isTls() {
        return this.security === "tls";
    }
    get isReality() {
        return this.security === "reality";
    }
    get sockoptSwitch() {
        return this.sockopt !== undefined;
    }
    set sockoptSwitch(value) {
        this.sockopt = value ? new SockoptStreamSettings() : undefined;
    }
    static fromJson(json = {}) {
        return new StreamSettings(json?.method ?? json?.network ?? "tcp", json?.security ?? "none", TlsStreamSettings.fromJson(json?.tlsSettings), RealityStreamSettings.fromJson(json?.realitySettings), TcpStreamSettings.fromJson(json?.tcpSettings), KcpStreamSettings.fromJson(json?.kcpSettings), WsStreamSettings.fromJson(json?.wsSettings), GrpcStreamSettings.fromJson(json?.grpcSettings), HttpUpgradeStreamSettings.fromJson(json?.httpupgradeSettings), XHTTPStreamSettings.fromJson(json?.xhttpSettings), HysteriaStreamSettings.fromJson(json?.hysteriaSettings), SockoptStreamSettings.fromJson(json?.sockopt));
    }
    toJson() {
        const network = this.network;
        return {
            network,
            security: this.security,
            tlsSettings: this.security === "tls" ? this.tls.toJson() : undefined,
            realitySettings: this.security === "reality" ? this.reality.toJson() : undefined,
            tcpSettings: network === "tcp" ? this.tcp.toJson() : undefined,
            kcpSettings: network === "kcp" ? this.kcp.toJson() : undefined,
            wsSettings: network === "ws" ? this.ws.toJson() : undefined,
            grpcSettings: network === "grpc" ? this.grpc.toJson() : undefined,
            httpupgradeSettings: network === "httpupgrade" ? this.httpupgrade.toJson() : undefined,
            xhttpSettings: network === "xhttp" ? this.xhttp.toJson() : undefined,
            hysteriaSettings: network === "hysteria" ? this.hysteria.toJson() : undefined,
            sockopt: this.sockopt ? this.sockopt.toJson() : undefined,
        };
    }
}
export class Mux extends CommonClass {
    enabled;
    concurrency;
    xudpConcurrency;
    xudpProxyUDP443;
    constructor(enabled = false, concurrency = 8, xudpConcurrency = 16, xudpProxyUDP443 = "reject") {
        super();
        this.enabled = Boolean(enabled);
        this.concurrency = concurrency ?? 8;
        this.xudpConcurrency = xudpConcurrency ?? 16;
        this.xudpProxyUDP443 = xudpProxyUDP443 ?? "reject";
    }
    static fromJson(json = {}) {
        if (!json || Object.keys(json).length === 0) {
            return new Mux();
        }
        return new Mux(json?.enabled, json?.concurrency, json?.xudpConcurrency, json?.xudpProxyUDP443);
    }
    toJson() {
        return {
            enabled: this.enabled,
            concurrency: this.concurrency,
            xudpConcurrency: this.xudpConcurrency,
            xudpProxyUDP443: this.xudpProxyUDP443,
        };
    }
}
export class Outbound extends CommonClass {
    tag;
    _protocol;
    settings;
    stream;
    sendThrough;
    mux;
    constructor(tag = "", protocol = Protocols.VLESS, settings = Outbound.Settings.getSettings(Protocols.VLESS), streamSettings = new StreamSettings(), sendThrough, mux = new Mux()) {
        super();
        this.tag = tag ?? "";
        this._protocol = protocol ?? Protocols.VLESS;
        this.settings = settings ?? Outbound.Settings.getSettings(this._protocol);
        this.stream = streamSettings;
        this.sendThrough = sendThrough;
        this.mux = mux;
    }
    get protocol() {
        return this._protocol;
    }
    set protocol(protocol) {
        this._protocol = protocol;
        this.settings = Outbound.Settings.getSettings(protocol);
        this.stream = new StreamSettings();
    }
    canEnableTls() {
        if (![
            Protocols.VMess,
            Protocols.VLESS,
            Protocols.Trojan,
            Protocols.Shadowsocks,
            Protocols.Hysteria,
        ].includes(this.protocol)) {
            return false;
        }
        if (this.protocol === Protocols.Hysteria) {
            return this.stream.network === "hysteria";
        }
        return ["tcp", "ws", "http", "grpc", "httpupgrade", "xhttp"].includes(this.stream.network);
    }
    canEnableTlsFlow() {
        if (this.stream.security !== "none" && this.stream.network === "tcp") {
            return this.protocol === Protocols.VLESS;
        }
        return false;
    }
    canEnableReality() {
        if (![Protocols.VLESS, Protocols.Trojan].includes(this.protocol))
            return false;
        return ["tcp", "http", "grpc", "xhttp"].includes(this.stream.network);
    }
    canEnableStream() {
        return [
            Protocols.VMess,
            Protocols.VLESS,
            Protocols.Trojan,
            Protocols.Shadowsocks,
            Protocols.Hysteria,
        ].includes(this.protocol);
    }
    canEnableMux() {
        if (this.settings &&
            typeof this.settings === "object" &&
            "flow" in this.settings) {
            const flow = this.settings.flow;
            if (flow && flow.length > 0) {
                if (this.mux)
                    this.mux.enabled = false;
                return false;
            }
        }
        if (this.stream.network === "xhttp") {
            if (this.mux)
                this.mux.enabled = false;
            return false;
        }
        return [
            Protocols.VMess,
            Protocols.VLESS,
            Protocols.Trojan,
            Protocols.Shadowsocks,
            Protocols.HTTP,
            Protocols.Socks,
        ].includes(this.protocol);
    }
    hasVnext() {
        return [Protocols.VMess, Protocols.VLESS].includes(this.protocol);
    }
    hasServers() {
        return [
            Protocols.Trojan,
            Protocols.Shadowsocks,
            Protocols.Socks,
            Protocols.HTTP,
        ].includes(this.protocol);
    }
    hasAddressPort() {
        return [
            Protocols.DNS,
            Protocols.VMess,
            Protocols.VLESS,
            Protocols.Trojan,
            Protocols.Shadowsocks,
            Protocols.Socks,
            Protocols.HTTP,
            Protocols.Hysteria,
        ].includes(this.protocol);
    }
    hasUsername() {
        return [Protocols.Socks, Protocols.HTTP].includes(this.protocol);
    }
    static fromJson(json = {}) {
        return new Outbound(json?.tag ?? "", json?.protocol ?? Protocols.VLESS, Outbound.Settings.fromProtocol(json?.protocol ?? Protocols.VLESS, json?.settings), StreamSettings.fromJson(json?.streamSettings), json?.sendThrough ?? "", Mux.fromJson(json?.mux));
    }
    toJson() {
        let stream;
        if (this.canEnableStream()) {
            stream = this.stream.toJson();
        }
        else if (this.stream?.sockopt) {
            stream = { sockopt: this.stream.sockopt.toJson() };
        }
        return {
            tag: this.tag || undefined,
            protocol: this.protocol,
            settings: this.settings instanceof CommonClass
                ? this.settings.toJson()
                : this.settings,
            streamSettings: stream,
            sendThrough: this.sendThrough || undefined,
            mux: this.mux?.enabled ? this.mux.toJson() : undefined,
        };
    }
    static fromLink(link) {
        if (!link || typeof link !== "string")
            return null;
        const parts = link.split("://");
        if (parts.length !== 2)
            return null;
        const scheme = parts[0].toLowerCase();
        try {
            switch (scheme) {
                case Protocols.VMess:
                    return Outbound.fromVmessLink(JSON.parse(base64Decode(parts[1])));
                case Protocols.VLESS:
                case Protocols.Trojan:
                case "ss":
                case "hysteria":
                case "hysteria2":
                case "hy2":
                    return Outbound.fromParamLink(link);
                default:
                    return null;
            }
        }
        catch {
            return null;
        }
    }
    static fromVmessLink(json = {}) {
        if (!json)
            return null;
        const stream = new StreamSettings(json?.net ?? "tcp", json?.tls ?? "none");
        const network = json?.net;
        if (network === "tcp") {
            stream.tcp = new TcpStreamSettings(json?.type ?? "none", json?.host ?? "", json?.path ?? "");
        }
        else if (network === "kcp") {
            stream.kcp = new KcpStreamSettings();
            stream.kcp.type = json?.type ?? "none";
            stream.kcp.seed = json?.path ?? "";
        }
        else if (network === "ws") {
            stream.ws = new WsStreamSettings(json?.path ?? "/", json?.host ?? "");
        }
        else if (network === "grpc") {
            stream.grpc = new GrpcStreamSettings(json?.path ?? "", json?.authority ?? "", json?.type === "multi");
        }
        else if (network === "httpupgrade") {
            stream.httpupgrade = new HttpUpgradeStreamSettings(json?.path ?? "/", json?.host ?? "");
        }
        else if (network === "xhttp") {
            stream.xhttp = new XHTTPStreamSettings(json?.path ?? "/", json?.host ?? "", json?.mode ?? "");
        }
        if (json?.tls === "tls") {
            stream.security = "tls";
            stream.tls = new TlsStreamSettings(json?.sni ?? "", json?.alpn ? String(json.alpn).split(",") : [], json?.fp ?? "", json?.ech ?? "", json?.pinSHA256 ?? json?.pcs ?? "", json?.verifyPeerCertByName ?? json?.vcn ?? "");
        }
        if (json?.tls === "reality") {
            stream.security = "reality";
            stream.reality = new RealityStreamSettings(json?.pbk ?? json?.fp ?? "", json?.fp ?? "", json?.sni ?? "", json?.sid ?? "", json?.spx ?? "", json?.pqv ?? "");
        }
        const port = Number(json?.port ?? 0);
        if (Number.isNaN(port))
            return null;
        return new Outbound(json?.ps ?? "", Protocols.VMess, new Outbound.VmessSettings(json?.add ?? "", port, json?.id ?? "", json?.scy ?? ""), stream);
    }
    static fromParamLink(link) {
        let url;
        try {
            url = new URL(link);
        }
        catch {
            return null;
        }
        const scheme = url.protocol.replace(":", "").toLowerCase();
        const isHysteriaLink = scheme === "hysteria" || scheme === "hysteria2" || scheme === "hy2";
        const type = isHysteriaLink
            ? "hysteria"
            : (url.searchParams.get("type") ?? "tcp");
        const security = isHysteriaLink
            ? "tls"
            : (url.searchParams.get("security") ?? "none");
        const stream = new StreamSettings(type, security);
        const headerType = url.searchParams.get("headerType") ?? undefined;
        const host = url.searchParams.get("host") ?? undefined;
        const path = url.searchParams.get("path") ?? undefined;
        const mode = url.searchParams.get("mode") ?? undefined;
        if (type === "tcp" || type === "none") {
            stream.tcp = new TcpStreamSettings(headerType ?? "none", host ?? "", path ?? "");
        }
        else if (type === "kcp") {
            stream.kcp = new KcpStreamSettings();
            stream.kcp.type = headerType ?? "none";
            stream.kcp.seed = path ?? "";
        }
        else if (type === "ws") {
            stream.ws = new WsStreamSettings(path ?? "/", host ?? "");
        }
        else if (type === "grpc") {
            stream.grpc = new GrpcStreamSettings(url.searchParams.get("serviceName") ?? "", url.searchParams.get("authority") ?? "", url.searchParams.get("mode") === "multi");
        }
        else if (type === "httpupgrade") {
            stream.httpupgrade = new HttpUpgradeStreamSettings(path ?? "/", host ?? "");
        }
        else if (type === "xhttp") {
            stream.xhttp = new XHTTPStreamSettings(path ?? "/", host ?? "", mode ?? "");
        }
        else if (type === "hysteria") {
            stream.hysteria = new HysteriaStreamSettings(scheme === "hysteria" ? 1 : 2, decodeURIComponent(url.username ?? ""), Number(url.searchParams.get("udpIdleTimeout") ?? 60) || 60);
        }
        if (security === "tls") {
            const fp = url.searchParams.get("fp") ?? "none";
            const alpn = url.searchParams.get("alpn");
            const sni = url.searchParams.get("sni") ?? "";
            const ech = url.searchParams.get("ech") ?? "";
            const pinnedPeerCertSha256 = url.searchParams.get("pcs") ?? url.searchParams.get("pinSHA256") ?? "";
            const verifyPeerCertByName = url.searchParams.get("vcn") ?? "";
            stream.tls = new TlsStreamSettings(sni, alpn ? alpn.split(",") : [], fp, ech, pinnedPeerCertSha256, verifyPeerCertByName);
        }
        if (security === "reality") {
            const pbk = url.searchParams.get("pbk") ?? "";
            const fp = url.searchParams.get("fp") ?? "";
            const sni = url.searchParams.get("sni") ?? "";
            const sid = url.searchParams.get("sid") ?? "";
            const spx = url.searchParams.get("spx") ?? "";
            const pqv = url.searchParams.get("pqv") ?? "";
            stream.reality = new RealityStreamSettings(pbk, fp, sni, sid, spx, pqv);
        }
        const regex = /([^@]+):\/\/([^@]+)@(.+):(\d+)(.*)$/;
        const match = link.match(regex);
        if (!match)
            return null;
        let [, protocol, userData, address, portString] = match;
        let port = Number(portString);
        if (Number.isNaN(port))
            port = 0;
        if (protocol === "ss") {
            protocol = Protocols.Shadowsocks;
            userData = base64Decode(userData);
        }
        if (protocol === "hysteria" ||
            protocol === "hysteria2" ||
            protocol === "hy2") {
            protocol = Protocols.Hysteria;
            userData = decodeURIComponent(userData);
        }
        let settings = null;
        switch (protocol) {
            case Protocols.VLESS: {
                const encryption = url.searchParams.get("encryption") ?? "none";
                settings = new Outbound.VLESSSettings(address, port, userData, url.searchParams.get("flow") ?? "", encryption);
                break;
            }
            case Protocols.Trojan:
                settings = new Outbound.TrojanSettings(address, port, userData);
                break;
            case Protocols.Shadowsocks: {
                const parts = userData.split(":");
                const method = parts.shift() ?? "";
                settings = new Outbound.ShadowsocksSettings(address, port, parts.join(":"), method, true);
                break;
            }
            case Protocols.Hysteria:
                settings = new Outbound.HysteriaSettings(address, port, scheme === "hysteria" ? 1 : 2);
                stream.network = "hysteria";
                stream.security = "tls";
                stream.hysteria.auth = userData;
                break;
            default:
                return null;
        }
        const remark = decodeURIComponent(url.hash ?? "");
        const tag = remark.length > 1 ? remark.substring(1) : `out-${protocol}-${port}`;
        return new Outbound(tag, protocol, settings, stream);
    }
    // Nested classes ---------------------------------------------------------
    static Settings = class Settings extends CommonClass {
        protocol;
        constructor(protocol) {
            super();
            this.protocol = protocol;
        }
        static getSettings(protocol) {
            switch (protocol) {
                case Protocols.Freedom:
                    return new Outbound.FreedomSettings();
                case Protocols.Blackhole:
                    return new Outbound.BlackholeSettings();
                case Protocols.DNS:
                    return new Outbound.DNSSettings();
                case Protocols.VMess:
                    return new Outbound.VmessSettings();
                case Protocols.VLESS:
                    return new Outbound.VLESSSettings();
                case Protocols.Trojan:
                    return new Outbound.TrojanSettings();
                case Protocols.Shadowsocks:
                    return new Outbound.ShadowsocksSettings();
                case Protocols.Hysteria:
                    return new Outbound.HysteriaSettings();
                case Protocols.Socks:
                    return new Outbound.SocksSettings();
                case Protocols.HTTP:
                    return new Outbound.HttpSettings();
                case Protocols.Wireguard:
                    return new Outbound.WireguardSettings();
                default:
                    return null;
            }
        }
        static fromProtocol(protocol, json) {
            switch (protocol) {
                case Protocols.Freedom:
                    return Outbound.FreedomSettings.fromJson(json);
                case Protocols.Blackhole:
                    return Outbound.BlackholeSettings.fromJson(json);
                case Protocols.DNS:
                    return Outbound.DNSSettings.fromJson(json);
                case Protocols.VMess:
                    return Outbound.VmessSettings.fromJson(json);
                case Protocols.VLESS:
                    return Outbound.VLESSSettings.fromJson(json);
                case Protocols.Trojan:
                    return Outbound.TrojanSettings.fromJson(json);
                case Protocols.Shadowsocks:
                    return Outbound.ShadowsocksSettings.fromJson(json);
                case Protocols.Hysteria:
                    return Outbound.HysteriaSettings.fromJson(json);
                case Protocols.Socks:
                    return Outbound.SocksSettings.fromJson(json);
                case Protocols.HTTP:
                    return Outbound.HttpSettings.fromJson(json);
                case Protocols.Wireguard:
                    return Outbound.WireguardSettings.fromJson(json);
                default:
                    return null;
            }
        }
        toJson() {
            return {};
        }
    };
    static FreedomSettings = class FreedomSettings extends CommonClass {
        domainStrategy;
        redirect;
        fragment;
        noises;
        constructor(domainStrategy = "", redirect = "", fragment = {}, noises = []) {
            super();
            this.domainStrategy = domainStrategy ?? "";
            this.redirect = redirect ?? "";
            this.fragment = fragment ?? {};
            this.noises = noises ?? [];
        }
        addNoise() {
            this.noises.push(new Outbound.FreedomSettings.Noise());
        }
        delNoise(index) {
            this.noises.splice(index, 1);
        }
        static fromJson(json = {}) {
            return new FreedomSettings(json?.domainStrategy ?? "", json?.redirect ?? "", json?.fragment ? FreedomSettings.Fragment.fromJson(json.fragment) : {}, Array.isArray(json?.noises)
                ? json.noises.map((noise) => FreedomSettings.Noise.fromJson(noise))
                : []);
        }
        toJson() {
            return {
                domainStrategy: ObjectUtil.isEmpty(this.domainStrategy)
                    ? undefined
                    : this.domainStrategy,
                redirect: ObjectUtil.isEmpty(this.redirect) ? undefined : this.redirect,
                fragment: Object.keys(this.fragment).length === 0 ? undefined : this.fragment,
                noises: this.noises.length === 0
                    ? undefined
                    : CommonClass.toJsonArray(this.noises),
            };
        }
        static Fragment = class Fragment extends CommonClass {
            packets;
            length;
            interval;
            maxSplit;
            constructor(packets = "1-3", length = "", interval = "", maxSplit = "") {
                super();
                this.packets = packets ?? "1-3";
                this.length = length ?? "";
                this.interval = interval ?? "";
                this.maxSplit = maxSplit ?? "";
            }
            static fromJson(json = {}) {
                return new Fragment(json?.packets ?? "1-3", json?.length ?? "", json?.interval ?? "", json?.maxSplit ?? "");
            }
        };
        static Noise = class Noise extends CommonClass {
            type;
            packet;
            delay;
            applyTo;
            constructor(type = "rand", packet = "10-20", delay = "10-16", applyTo = "ip") {
                super();
                this.type = type ?? "rand";
                this.packet = packet ?? "10-20";
                this.delay = delay ?? "10-16";
                this.applyTo = applyTo ?? "ip";
            }
            static fromJson(json = {}) {
                return new Noise(json?.type ?? "rand", json?.packet ?? "10-20", json?.delay ?? "10-16", json?.applyTo ?? "ip");
            }
            toJson() {
                return {
                    type: this.type,
                    packet: this.packet,
                    delay: this.delay,
                    applyTo: this.applyTo,
                };
            }
        };
    };
    static BlackholeSettings = class BlackholeSettings extends CommonClass {
        type;
        customResponseData;
        constructor(type, customResponseData) {
            super();
            this.type = type;
            this.customResponseData = customResponseData;
        }
        static fromJson(json = {}) {
            return new BlackholeSettings(json?.response?.type, json?.response?.customResponseData);
        }
        toJson() {
            return {
                response: ObjectUtil.isEmpty(this.type)
                    ? undefined
                    : { type: this.type, customResponseData: this.customResponseData },
            };
        }
    };
    static DNSSettings = class DNSSettings extends CommonClass {
        network;
        address;
        port;
        nonIPQuery;
        blockTypes;
        constructor(network = "udp", address = "", port = 53, nonIPQuery = "reject", blockTypes = []) {
            super();
            this.network = network ?? "udp";
            this.address = address ?? "";
            this.port = port ?? 53;
            this.nonIPQuery = nonIPQuery ?? "reject";
            this.blockTypes = blockTypes ?? [];
        }
        static fromJson(json = {}) {
            return new DNSSettings(json?.network ?? "udp", json?.address ?? "", json?.port ?? 53, json?.nonIPQuery ?? "reject", Array.isArray(json?.blockTypes) ? json.blockTypes : []);
        }
    };
    static VmessSettings = class VmessSettings extends CommonClass {
        address;
        port;
        id;
        security;
        constructor(address = "", port = 0, id = "", security = "") {
            super();
            this.address = address ?? "";
            this.port = port ?? 0;
            this.id = id ?? "";
            this.security = security ?? "";
        }
        static fromJson(json = {}) {
            if (ObjectUtil.isArrEmpty(json?.vnext))
                return new Outbound.VmessSettings();
            const server = json.vnext[0];
            const user = Array.isArray(server?.users) && server.users[0] ? server.users[0] : {};
            return new Outbound.VmessSettings(server?.address ?? "", server?.port ?? 0, user?.id ?? "", user?.security ?? "");
        }
        toJson() {
            return {
                vnext: [
                    {
                        address: this.address,
                        port: this.port,
                        users: [{ id: this.id, security: this.security }],
                    },
                ],
            };
        }
    };
    static VLESSSettings = class VLESSSettings extends CommonClass {
        address;
        port;
        id;
        flow;
        encryption;
        constructor(address = "", port = 0, id = "", flow = "", encryption = "") {
            super();
            this.address = address ?? "";
            this.port = port ?? 0;
            this.id = id ?? "";
            this.flow = flow ?? "";
            this.encryption = encryption ?? "";
        }
        static fromJson(json = {}) {
            if (Object.hasOwn(json, "address") || json?.reverse) {
                return new Outbound.VLESSSettings(json?.address ?? "", json?.port ?? 0, json?.id ?? "", json?.flow ?? "", json?.encryption ?? "none");
            }
            if (ObjectUtil.isArrEmpty(json?.vnext))
                return new Outbound.VLESSSettings();
            const server = json.vnext[0];
            const user = Array.isArray(server?.users) && server.users[0] ? server.users[0] : {};
            return new Outbound.VLESSSettings(server?.address ?? "", server?.port ?? 0, user?.id ?? "", user?.flow ?? "", user?.encryption ?? "");
        }
        toJson() {
            return {
                vnext: [
                    {
                        address: this.address,
                        port: this.port,
                        users: [
                            { id: this.id, flow: this.flow, encryption: this.encryption },
                        ],
                    },
                ],
            };
        }
    };
    static TrojanSettings = class TrojanSettings extends CommonClass {
        address;
        port;
        password;
        constructor(address = "", port = 0, password = "") {
            super();
            this.address = address ?? "";
            this.port = port ?? 0;
            this.password = password ?? "";
        }
        static fromJson(json = {}) {
            if (ObjectUtil.isArrEmpty(json?.servers))
                return new Outbound.TrojanSettings();
            const server = json.servers[0];
            return new Outbound.TrojanSettings(server?.address ?? "", server?.port ?? 0, server?.password ?? "");
        }
        toJson() {
            return {
                servers: [
                    {
                        address: this.address,
                        port: this.port,
                        password: this.password,
                    },
                ],
            };
        }
    };
    static ShadowsocksSettings = class ShadowsocksSettings extends CommonClass {
        address;
        port;
        password;
        method;
        ivCheck;
        uot;
        UoTVersion;
        constructor(address = "", port = 0, password = "", method = "", ivCheck, uot, UoTVersion) {
            super();
            this.address = address ?? "";
            this.port = port ?? 0;
            this.password = password ?? "";
            this.method = method ?? "";
            this.ivCheck = ivCheck;
            this.uot = uot;
            this.UoTVersion = UoTVersion;
        }
        static fromJson(json = {}) {
            let servers = json?.servers;
            if (ObjectUtil.isArrEmpty(servers))
                servers = [{}];
            const server = servers[0];
            return new Outbound.ShadowsocksSettings(server?.address ?? "", server?.port ?? 0, server?.password ?? "", server?.method ?? "", server?.ivCheck, server?.uot, server?.UoTVersion);
        }
        toJson() {
            return {
                servers: [
                    {
                        address: this.address,
                        port: this.port,
                        password: this.password,
                        method: this.method,
                        ivCheck: this.ivCheck,
                        uot: this.uot,
                        UoTVersion: this.UoTVersion,
                    },
                ],
            };
        }
    };
    static HysteriaSettings = class HysteriaSettings extends CommonClass {
        address;
        port;
        version;
        constructor(address = "", port = 443, version = 2) {
            super();
            this.address = address ?? "";
            this.port = port ?? 443;
            this.version = Number(version) || 2;
        }
        static fromJson(json = {}) {
            return new Outbound.HysteriaSettings(json?.address ?? "", json?.port ?? 443, json?.version ?? 2);
        }
        toJson() {
            return {
                address: this.address,
                port: this.port,
                version: this.version || 2,
            };
        }
    };
    static SocksSettings = class SocksSettings extends CommonClass {
        address;
        port;
        user;
        pass;
        constructor(address = "", port = 0, user = "", pass = "") {
            super();
            this.address = address ?? "";
            this.port = port ?? 0;
            this.user = user ?? "";
            this.pass = pass ?? "";
        }
        static fromJson(json = {}) {
            let servers = json?.servers;
            if (ObjectUtil.isArrEmpty(servers))
                servers = [{ users: [{}] }];
            const server = servers[0];
            const users = Array.isArray(server?.users) && server.users[0] ? server.users[0] : {};
            return new Outbound.SocksSettings(server?.address ?? "", server?.port ?? 0, users?.user ?? "", users?.pass ?? "");
        }
        toJson() {
            return {
                servers: [
                    {
                        address: this.address,
                        port: this.port,
                        users: ObjectUtil.isEmpty(this.user)
                            ? []
                            : [{ user: this.user, pass: this.pass }],
                    },
                ],
            };
        }
    };
    static HttpSettings = class HttpSettings extends CommonClass {
        address;
        port;
        user;
        pass;
        constructor(address = "", port = 0, user = "", pass = "") {
            super();
            this.address = address ?? "";
            this.port = port ?? 0;
            this.user = user ?? "";
            this.pass = pass ?? "";
        }
        static fromJson(json = {}) {
            let servers = json?.servers;
            if (ObjectUtil.isArrEmpty(servers))
                servers = [{ users: [{}] }];
            const server = servers[0];
            const users = Array.isArray(server?.users) && server.users[0] ? server.users[0] : {};
            return new Outbound.HttpSettings(server?.address ?? "", server?.port ?? 0, users?.user ?? "", users?.pass ?? "");
        }
        toJson() {
            return {
                servers: [
                    {
                        address: this.address,
                        port: this.port,
                        users: ObjectUtil.isEmpty(this.user)
                            ? []
                            : [{ user: this.user, pass: this.pass }],
                    },
                ],
            };
        }
    };
    static WireguardSettings = class WireguardSettings extends CommonClass {
        mtu;
        secretKey;
        pubKey;
        address;
        workers;
        domainStrategy;
        remoteDNS;
        reserved;
        peers;
        noKernelTun;
        constructor(mtu = 1420, secretKey = "", address = [""], workers = 2, domainStrategy = "", remoteDNS = [], reserved = "", peers = [
            new WireguardSettings.Peer(),
        ], noKernelTun = false) {
            super();
            this.mtu = mtu ?? 1420;
            this.secretKey = secretKey ?? "";
            this.pubKey =
                this.secretKey.length > 0
                    ? tryGetWireguardPublicKey(this.secretKey)
                    : "";
            this.address = Array.isArray(address)
                ? address.join(",")
                : (address ?? "");
            this.workers = workers ?? 2;
            this.domainStrategy = domainStrategy ?? "";
            this.remoteDNS = remoteDNS ?? [];
            this.reserved = Array.isArray(reserved)
                ? reserved.join(",")
                : (reserved ?? "");
            this.peers = peers ?? [new WireguardSettings.Peer()];
            this.noKernelTun = Boolean(noKernelTun);
        }
        addPeer() {
            this.peers.push(new WireguardSettings.Peer());
        }
        delPeer(index) {
            this.peers.splice(index, 1);
        }
        static fromJson(json = {}) {
            return new WireguardSettings(json?.mtu ?? 1420, json?.secretKey ?? "", json?.address ?? [""], json?.workers ?? 2, json?.domainStrategy ?? "", Array.isArray(json?.remoteDNS) ? json.remoteDNS : [], json?.reserved ?? "", Array.isArray(json?.peers)
                ? json.peers.map((peer) => WireguardSettings.Peer.fromJson(peer))
                : [new WireguardSettings.Peer()], json?.noKernelTun ?? false);
        }
        toJson() {
            return {
                mtu: this.mtu || undefined,
                secretKey: this.secretKey,
                address: this.address ? this.address.split(",") : [],
                workers: this.workers || undefined,
                domainStrategy: WireguardDomainStrategy.includes(this.domainStrategy)
                    ? this.domainStrategy
                    : undefined,
                remoteDNS: this.remoteDNS.length ? this.remoteDNS : undefined,
                reserved: this.reserved
                    ? this.reserved
                        .split(",")
                        .map((value) => Number(value))
                        .filter((value) => !Number.isNaN(value))
                    : undefined,
                peers: CommonClass.toJsonArray(this.peers),
                noKernelTun: this.noKernelTun,
            };
        }
        static Peer = class Peer extends CommonClass {
            publicKey;
            psk;
            allowedIPs;
            endpoint;
            keepAlive;
            constructor(publicKey = "", psk = "", allowedIPs = ["0.0.0.0/0", "::/0"], endpoint = "", keepAlive = 0) {
                super();
                this.publicKey = publicKey ?? "";
                this.psk = psk ?? "";
                this.allowedIPs = allowedIPs ?? ["0.0.0.0/0", "::/0"];
                this.endpoint = endpoint ?? "";
                this.keepAlive = keepAlive ?? 0;
            }
            static fromJson(json = {}) {
                return new Outbound.WireguardSettings.Peer(json?.publicKey ?? "", json?.preSharedKey ?? "", Array.isArray(json?.allowedIPs)
                    ? json.allowedIPs
                    : ["0.0.0.0/0", "::/0"], json?.endpoint ?? "", json?.keepAlive ?? 0);
            }
            toJson() {
                return {
                    publicKey: this.publicKey,
                    preSharedKey: this.psk.length > 0 ? this.psk : undefined,
                    allowedIPs: this.allowedIPs?.length ? this.allowedIPs : undefined,
                    endpoint: this.endpoint,
                    keepAlive: this.keepAlive || undefined,
                };
            }
        };
    };
}
export class SizeFormatter {
    static sizeFormat(size) {
        if (size <= 0 || Number.isNaN(size))
            return "0 B";
        const units = ["B", "KB", "MB", "GB", "TB", "PB"];
        let index = 0;
        let n = size;
        while (n >= 1024 && index < units.length - 1) {
            n /= 1024;
            index++;
        }
        return `${n.toFixed(2)} ${units[index]}`;
    }
}
