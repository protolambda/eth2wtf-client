import React, {Component} from 'react';
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Slider from "@material-ui/core/Slider";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import FormGroup from "@material-ui/core/FormGroup";
import "./LayoutOptions.css";

export type LayoutOptionsData = {
    // style of DAG
    ranker: string,
    // ignore empty slots or not
    compact: boolean,
    // the separation between adjacent nodes with the same slot
    nodeSep: number,
    // the separation between adjacent edges with the same slot
    edgeSep: number,
    // the separation between slots
    rankSep: number,
}

type LayoutOptionsState = {
    data: LayoutOptionsData
}

interface LayoutOptionsProps {
    onOptions: (data: LayoutOptionsData) => void
}

export const defaultLayoutOpts: Readonly<LayoutOptionsData> = {
    ranker: 'network-simplex',
    compact: false,
    nodeSep: 10,
    edgeSep: 10,
    rankSep: 5
};

const rankers: Record<string, string> = {
    'network-simplex': 'Simplex',
    'tight-tree': 'Tight tree',
    'longest-path': 'Longest path',
};

export class LayoutOptions extends Component<LayoutOptionsProps, LayoutOptionsState> {

    state: Readonly<LayoutOptionsState> = {
        data: defaultLayoutOpts,
    };

    setRanker(event: React.ChangeEvent<{ name?: string; value: unknown }>) {
        this.setState(s => ({
            data: {
                ...s.data,
                [event.target.name as string]: event.target.value,
            },
        }), () => this.props.onOptions(this.state.data));
    }

    setBasic = (key: string) => (event: any, newValue: number | number[] | boolean) => {
        this.setState(s => ({
            data: {
                ...s.data,
                [key]: newValue
            }
        }), () => this.props.onOptions(this.state.data));
    };

    render() {
        const data = this.state.data;

        return (
            <FormGroup>
                <FormControlLabel
                    control={
                        <Select
                            className="layout-ranker-select"
                            value={data.ranker}
                            onChange={this.setRanker.bind(this)}
                            inputProps={{
                                name: 'ranker',
                                id: 'ranker',
                            }}
                        >
                            {Object.entries(rankers).map(([k, v]) => (<MenuItem key={k} value={k}>{v}</MenuItem>))}
                        </Select>
                    }
                    label="DAG style"/>

                <FormControlLabel
                    control={
                        <Checkbox
                            checked={data.compact}
                            onChange={this.setBasic('compact')}
                            value="compact"
                            color="primary"
                        />
                    }
                    label="Compact graph"
                />

                <FormControlLabel
                    control={
                        <Slider
                            className="layout-slider"
                            min={1}
                            max={100}
                            defaultValue={20}
                            onChangeCommitted={this.setBasic('nodeSep')}
                            step={1}
                            valueLabelDisplay="auto"
                        />
                    }
                    label="Node separation"
                />

                <FormControlLabel
                    control={
                        <Slider
                            className="layout-slider"
                            min={1}
                            max={200}
                            defaultValue={20}
                            onChangeCommitted={this.setBasic('edgeSep')}
                            step={1}
                            valueLabelDisplay="auto"
                        />
                    }
                    label="Edge separation"
                />

                <FormControlLabel
                    control={
                        <Slider
                            className="layout-slider"
                            min={1}
                            max={200}
                            defaultValue={20}
                            onChangeCommitted={this.setBasic('rankSep')}
                            step={1}
                            valueLabelDisplay="auto"
                        />
                    }
                    label="Slot separation"
                />
            </FormGroup>
        );
    }
}
