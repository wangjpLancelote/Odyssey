import type { PlotEdge } from "@odyssey/shared";

export type PlotTree = {
  sessionId: string;
  edges: PlotEdge[];
};

export function createPlotTree(sessionId: string): PlotTree {
  return { sessionId, edges: [] };
}

export function appendPlotEdge(tree: PlotTree, edge: PlotEdge): PlotTree {
  return {
    ...tree,
    edges: [...tree.edges, edge]
  };
}

export function getBranchesFromNode(tree: PlotTree, nodeId: string): PlotEdge[] {
  return tree.edges.filter((edge) => edge.fromNodeId === nodeId);
}
