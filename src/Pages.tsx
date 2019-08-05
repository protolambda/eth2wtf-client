import React from 'react';
import {BrowserRouter as Router, Switch, Route} from 'react-router-dom';
import {Main} from "./components/Main";
import About from "./components/About";

const Pages: React.FC = () => {
    return (
        <Router>
            <Switch>
                <Route exact path='/' component={Main}/>
                <Route exact strict={false} path='/about' component={About}/>
            </Switch>
        </Router>
    );
};

export default Pages;
