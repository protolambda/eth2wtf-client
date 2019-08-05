import React, {Component} from 'react';
// @ts-ignore
import CytoscapeComponent from 'react-cytoscapejs';
// @ts-ignore
import klay from 'cytoscape-klay';
import cytoscape from "cytoscape";
import {Paper, Typography} from "@material-ui/core";

cytoscape.use(klay);

type MainState = {
    loaded: boolean
}

const cytoStyles: Array<cytoscape.Stylesheet> = [
    {
        selector: 'edge',
        style: {
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle'
        }
    }
];

type CY = cytoscape.Core;

export class Main extends Component<{}, MainState> {

    private cy: CY | undefined;

    makeCyRef = (cy: CY) => {
        this.cy = cy;
    };

    layout = () => {
        if (this.cy) {
            const layout = this.cy.layout({name: 'klay'});
            layout.run();
        }
    };

    render() {
        return (
            <>
                <Paper>
                    <Typography variant="h5" component="h3">
                        TODO graph component
                    </Typography>
                    <Typography component="p">
                        Work in progress
                    </Typography>
                </Paper>
                <CytoscapeComponent elements={[]}
                                    stylesheet={cytoStyles}
                                    layout={{name: "preset"}}
                                    pan={{x: 0, y: 0}}
                                    cy={this.makeCyRef}/>
            </>
        )
    }
}
