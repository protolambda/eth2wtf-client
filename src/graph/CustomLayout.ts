import dagre from "dagre";
import {Core, CytoscapeOptions, EdgeSingular, NodeSingular} from "cytoscape";
import {GraphEventType, pixelsPerSecond, CustomLayoutOptions} from "./Constants";

function CustomLayoutEngine(options?: CytoscapeOptions) {
    // @ts-ignore
    this.options = {
        // @ts-ignore
        ...this.options,
        ...options
    };
}

CustomLayoutEngine.prototype.run = function () {
    let options = this.options;
    let layout = this;

    let cy: Core = options.cy; // cy is automatically populated for us in the constructor
    let eles = options.eles;

    const customOpts: CustomLayoutOptions = options.customOpts;

    let g = new dagre.graphlib.Graph({
        multigraph: true,
        compound: false
    });

    g.setGraph({
        nodesep: customOpts.nodeSep,
        edgesep: customOpts.nodeSep * 2,
        ranksep: customOpts.slotSep,
        rankdir: 'LR',
        ranker: 'longest-path',//customOpts.pullLatest ? 'longest-path' : 'tight-tree' //'network-simplex',
    });

    g.setDefaultEdgeLabel(function () {
        return {};
    });
    g.setDefaultNodeLabel(function () {
        return {};
    });

    // add nodes to dagre
    let nodes = eles.nodes();
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        let nbb = node.layoutDimensions(options);

        g.setNode(node.id(), {
            width: nbb.w,
            height: nbb.h,
            name: node.id()
        });

        // console.log( g.node(node.id()) );
    }

    // set compound parents
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];

        if (node.isChild()) {
            g.setParent(node.id(), node.parent().id());
        }
    }

    // add edges to dagre
    let edges = eles.edges().stdFilter(function (edge: EdgeSingular) {
        return !edge.source().isParent() && !edge.target().isParent(); // dagre can't handle edges on compound nodes
    });
    for (let i = 0; i < edges.length; i++) {
        let edge: EdgeSingular = edges[i];


        const src = edge.source();
        const tar = edge.target();

        const srcSlot: number | undefined = src.data('slot');
        const tarSlot: number | undefined = tar.data('slot');

        let edgeLen = 1;
        if (!customOpts.compact && srcSlot !== undefined && tarSlot !== undefined) {
            edgeLen = Math.abs(tarSlot - srcSlot)
        }

        g.setEdge(edge.source().id(), edge.target().id(), {
            minlen: edgeLen,
            weight: 10000 / (edgeLen + 1),
            name: edge.id()
        }, edge.id());
    }

    dagre.layout(g);

    let gNodeIds = g.nodes();
    for (let i = 0; i < gNodeIds.length; i++) {
        let id = gNodeIds[i];
        let n = g.node(id);

        const cyN = cy.getElementById(id);
        cyN.scratch().dagre = n;
    }


    nodes.layoutPositions(layout, options, function (ele: NodeSingular) {
        let dModel = ele.scratch().dagre;

        const contentType: GraphEventType | undefined = ele.data('content_type');
        if (!customOpts.pullLatest && !customOpts.compact && contentType !== undefined) {
            const p = contentType.transform(ele, {
                x: dModel.x,
                y: dModel.y,
            });
            return {
                x: p.x,
                y: p.y,
            }
        } else {
            // keep the node position as-is.
            return ({
                x: dModel.x,
                y: dModel.y,
            })
        }
    });

    return this; // chaining
};

export default function register(cy?: any): void {
    if (!cy) {
        return;
    }
    // Initialize extension
    // ...

    // Register extension
    cy('layout', 'custom_layout', CustomLayoutEngine);
}
