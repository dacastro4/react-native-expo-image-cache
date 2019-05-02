// @flow
import React from "react";
import {StyleSheet, View} from "react-native";
import * as Progress from "react-native-progress";

const CircularProgress = (allProps: {}) => {

    const {type, progress, ...props} = allProps;

    let Indicator;

    if (type === "circle-snail") {
        Indicator = Progress.CircleSnail;
    } else if (type === "bar") {
        Indicator = Progress.Bar;
    } else if (type === "pie") {
        Indicator = Progress.Pie;
    } else {
        Indicator = Progress.Circle;
    }

    return (
        <View style={styles.circles}>
            <Indicator
                style={styles.progress}
                progress={progress}
                {...props}
            />
        </View>
    );
};

// default values for props
CircularProgress.defaultProps = {
    type: "circle"
};

const styles = StyleSheet.create({
    circles: {
        flexDirection: "row",
        alignItems: "center"
    },
    progress: {
        margin: 10
    }
});


export default CircularProgress;
