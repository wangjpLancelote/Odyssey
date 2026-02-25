import type { FootprintCheckpoint, FootprintMap } from "@odyssey/shared";

export function createFootprintMap(sessionId: string, playerId: string): FootprintMap {
  return {
    sessionId,
    playerId,
    checkpoints: [],
    visitedNodeIds: []
  };
}

export function appendVisitedNode(map: FootprintMap, nodeId: string): FootprintMap {
  if (map.visitedNodeIds.includes(nodeId)) return map;
  return {
    ...map,
    visitedNodeIds: [...map.visitedNodeIds, nodeId]
  };
}

export function addCheckpoint(
  map: FootprintMap,
  nodeId: string,
  plotCursor: string,
  metadata: Record<string, unknown> = {}
): FootprintMap {
  const checkpoint: FootprintCheckpoint = {
    checkpointId: `cp-${map.sessionId}-${map.checkpoints.length + 1}`,
    sessionId: map.sessionId,
    nodeId,
    plotCursor,
    metadata,
    createdAt: new Date().toISOString()
  };

  return {
    ...map,
    checkpoints: [...map.checkpoints, checkpoint]
  };
}

export function restoreCheckpoint(
  map: FootprintMap,
  checkpointId: string
): FootprintCheckpoint | null {
  return map.checkpoints.find((cp) => cp.checkpointId === checkpointId) ?? null;
}
