export const sumOutboundTraffic = (records, selectedTarget, outboundId, tag, aggregateTargets) => records.reduce((total, record) => {
    const targetId = record.target_id || "master";
    const matchesTarget = Boolean(aggregateTargets && outboundId) || targetId === selectedTarget;
    const matchesOutbound = outboundId
        ? record.outbound_id === outboundId
        : record.tag === tag;
    if (!matchesTarget || !matchesOutbound)
        return total;
    return {
        up: total.up + (Number(record.up) || 0),
        down: total.down + (Number(record.down) || 0),
    };
}, { up: 0, down: 0 });
