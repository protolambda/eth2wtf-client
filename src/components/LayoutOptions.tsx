import React, {Component} from 'react';
import Slider from "@material-ui/core/Slider";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import FormGroup from "@material-ui/core/FormGroup";
import "./LayoutOptions.css";
import {LayoutOptionsData} from "../graph/Graph";

type LayoutOptionsState = {
    data: LayoutOptionsData
}

interface LayoutOptionsProps {
    onOptions: (data: LayoutOptionsData) => void
}

export const defaultLayoutOpts: Readonly<LayoutOptionsData> = {
    compact: false,
    nodeSep: 10,
    edgeSep: 10
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
            </FormGroup>
        );
    }
}
