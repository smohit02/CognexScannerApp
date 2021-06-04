import React, { Component } from 'react';
import { Alert, AppState, Dimensions, FlatList, Image, Modal, NativeEventEmitter, PermissionsAndroid, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CMBReader, cmb } from 'cmbsdk-react-native';
// import { StackActions } from '@react-navigation/routers';
// import { FlatList } from 'react-native-gesture-handler';


const scannerListener = new NativeEventEmitter(cmb);


const usePreconfiguredDevice = false;
var deviceClass = CMBReader.DEVICE_TYPE.MXReader;
var cameraMode = CMBReader.CAMERA_MODE.NoAimer;

var listenersNames = [];
var listeners = [];


var scanResults = null;

var sampleApp = null;

function selectDeviceFromPicker() {
    var readerOptions = [];

    readerOptions.push
        (
            {
                text: 'MX Scanner (MX-1xxx)', onPress: () => {
                    deviceClass = CMBReader.DEVICE_TYPE.MXReader;
                    createReaderDevice();
                }
            }
        );

    if (Platform.OS == 'ios') {
        readerOptions.push
            (
                {
                    text: 'MX-100', onPress: () => {
                        deviceClass = CMBReader.DEVICE_TYPE.Camera;
                        cameraMode = CMBReader.CAMERA_MODE.ActiveAimer;
                        if (Platform.OS == 'android' && Platform.Version >= 23) {
                            requestCameraPermission();
                        } else {
                            createReaderDevice();
                        }
                    }
                }
            );
    }


    readerOptions.push
        (
            {
                text: 'Phone Camera', onPress: () => {
                    deviceClass = CMBReader.DEVICE_TYPE.Camera;
                    cameraMode = CMBReader.CAMERA_MODE.NoAimer;
                    if (Platform.OS == 'android' && Platform.Version >= 23) {
                        requestCameraPermission();
                    } else {
                        createReaderDevice();
                    }
                }
            }
        );

    readerOptions.push
        (
            {
                text: 'Cancel'
            }
        );

    Alert.alert
        (
            "Select device",
            "Pick a Reader Device type",
            readerOptions
        );
}

async function requestCameraPermission() {
    try {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
                'title': 'Camera permission is required',
                'message': 'You need to allow permission to use the Camera to be able to scan barcodes'
            }
        )
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            console.log("CMB - You can use the camera")
            createReaderDevice();
        } else {
            console.log("CMB - Camera permission denied")
        }
    } catch (err) {
        console.warn(err)
    }
}


function createReaderDevice() {
    if (sampleApp && sampleApp.state.connected == CMBReader.CONNECTION_STATE.Connected) {
        cmb.disconnect();
    }

    isScanning = false;

    cmb.setCameraMode(cameraMode);

    cmb.loadScanner(deviceClass).then((response) => {
        connectToReaderDevice();
    });

    updateDeviceType();
}

function connectToReaderDevice() {
    cmb.getAvailability().then((response) => {
        if (response == CMBReader.AVAILABILITY.Available) {

            if (deviceClass == CMBReader.DEVICE_TYPE.Camera && cameraMode == CMBReader.CAMERA_MODE.ActiveAimer) {
                cmb.toggleConnectionAlert(true)
            }

            cmb.connect().then((connectMethodResult) => {
            }).catch((failure) => {
                console.log("CMB - connectReader failed: " + JSON.stringify(failure))
            });
        }
    }).catch((rejecter) => {
        console.log("CMB - getAvailability failed: " + JSON.stringify(rejecter))
    })
}


function configureReaderDevice() {

    cmb.setSymbology(CMBReader.SYMBOLOGY.C128, true, CMBReader.SYMBOLOGY_NAME.C128);
    cmb.setSymbology(CMBReader.SYMBOLOGY.C39, true, CMBReader.SYMBOLOGY_NAME.C39);

    cmb.sendCommand("GET DEVICE.TYPE", "DEVICE.TYPE");
    cmb.sendCommand("GET DEVICE.FIRMWARE-VER", "DEVICE.FIRMWARE-VER");


    cmb.enableImage(false).then((resolve) => {
    }).catch((failure) => {
        console.log("CMB - enableImage failed: " + JSON.stringify(failure))
    });

    cmb.enableImageGraphics(false).then((resolve) => {
    }).catch((failure) => {
        console.log("CMB - enableImageGraphics failed: " + JSON.stringify(failure))
    });

    cmb.setStopScannerOnRotate(false);


    if (deviceClass == CMBReader.DEVICE_TYPE.Camera) {

        cmb.sendCommand("SET DECODER.EFFORT 3", "DECODER.EFFORT");
    } else if (deviceClass == CMBReader.DEVICE_TYPE.MXReader) {
        cmb.sendCommand("CONFIG.SAVE", "CONFIG.SAVE");
    }

    cmb.sendCommand("GET DEVICE.TYPE", new Date().getTime().toString());
}

function toggleScanner() {
    if (sampleApp) {
        if (sampleApp.state.isScanning) {
            cmb.stopScanning().then((response) => {
                updateScanningState(false)
            });
        } else {
            cmb.startScanning().then((resolver) => {
                updateScanningState(true)
            }).catch((rejecter) => {
                updateScanningState(false)
            });
        }
    }
}

function updateScanningState(isScanning) {
    if (sampleApp) {
        sampleApp.setState({
            isScanning: isScanning,
            connected: sampleApp.state.connected,
            device: sampleApp.state.device,
            results: sampleApp.state.results
        }
        );
    }
}

function updateReaderDeviceConnectionState(isConnected) {
    if (sampleApp) {
        sampleApp.setState({
            isScanning: sampleApp.state.isScanning,
            connected: isConnected,
            device: sampleApp.state.device,
            results: sampleApp.state.results
        }
        );
    }
}

function updateDeviceType() {
    if (sampleApp) {
        sampleApp.setState({
            isScanning: sampleApp.state.isScanning,
            connected: sampleApp.state.connected,
            device: deviceClass,
            results: sampleApp.state.results
        }
        );
    }
}

function availabilityChanged(availability) {
    if (availability == CMBReader.AVAILABILITY.Available) {
        connectToReaderDevice();
    }
    console.log('CMB - AvailabilityChanged ' + JSON.stringify(availability));
}

function connectionStateChanged(connectionState) {
    updateScanningState(false)
    updateReaderDeviceConnectionState(connectionState == CMBReader.CONNECTION_STATE.Connected)

    if (deviceClass == CMBReader.DEVICE_TYPE.Camera &&
        cameraMode == CMBReader.CAMERA_MODE.ActiveAimer &&
        (connectionState == CMBReader.CONNECTION_STATE.Connected || connectionState == CMBReader.CONNECTION_STATE.Disconnected)) {
        cmb.toggleConnectionAlert(false)
    }

    if (connectionState == CMBReader.CONNECTION_STATE.Connected) {
        configureReaderDevice();
    }
}

function readResultReceived(readResult) {
    console.log(JSON.stringify(readResult))
    if (sampleApp) {
        sampleApp.setState({
            isScanning: false,
            connected: sampleApp.state.connected,
            device: sampleApp.state.device,
            results: readResult.subReadResults.length > 0 ? readResult.subReadResults : readResult.readResults
        }
        );
    }
}

function commandCompleted(response) {
    if (response.commandID == "DEVICE.TYPE") {
    }

    if (response.commandID == "DEVICE.FIRMWARE-VER") {
    }

    console.log('CMB - CommandCompleted ' + JSON.stringify(response));
}

function Item({ title }) {
    return (
        <View style={styles.item}>
            <Text style={styles.title}>{title}</Text>
        </View>
    );
}

class App extends Component {

    constructor(props) {
        super(props)
        this.state = {
            isScanning: false,
            connected: false,
            device: deviceClass,
            results: []
        }
    }


    _handleAppStateChange = (nextAppState) => {
        if (nextAppState === 'active') {
            connectToReaderDevice()
        } else {
            cmb.disconnect();
        }
    };

    componentDidMount() {
        sampleApp = this;

        AppState.addEventListener('change', this._handleAppStateChange);

        cmb.setPreviewContainerFullScreen();

        if (usePreconfiguredDevice) {
            createReaderDevice();
        }
        // else {
        //   selectDeviceFromPicker();
        // }

        if (!listenersNames.includes(CMBReader.EVENT.ReadResultReceived)) {
            listenersNames.push(CMBReader.EVENT.ReadResultReceived);
            listeners.push(
                scannerListener.addListener(
                    CMBReader.EVENT.ReadResultReceived,
                    (results) => { readResultReceived(results) }
                )
            );
        }

        if (!listenersNames.includes(CMBReader.EVENT.CommandCompleted)) {
            listenersNames.push(CMBReader.EVENT.CommandCompleted);
            listeners.push(
                scannerListener.addListener(
                    CMBReader.EVENT.CommandCompleted,
                    (response) => { commandCompleted(response) }
                )
            );
        }

        if (!listenersNames.includes(CMBReader.EVENT.AvailabilityChanged)) {
            listenersNames.push(CMBReader.EVENT.AvailabilityChanged);
            listeners.push(
                scannerListener.addListener(
                    CMBReader.EVENT.AvailabilityChanged,
                    (availability) => { availabilityChanged(availability) }
                )
            );
        }

        if (!listenersNames.includes(CMBReader.EVENT.ConnectionStateChanged)) {
            listenersNames.push(CMBReader.EVENT.ConnectionStateChanged);
            listeners.push(
                scannerListener.addListener(
                    CMBReader.EVENT.ConnectionStateChanged,
                    (connectionState) => { connectionStateChanged(connectionState) }
                )
            );
        }
    }

    componentWillUnmount() {
        sampleApp = null;
        console.log("Capture Unmounted")
        // Remove the AppState change observer
        AppState.removeEventListener('change', this._handleAppStateChange);

        // remove event listeners
        listenersNames = [];
        for (var i = listeners.length - 1; i >= 0; i--) {
            listeners[i].remove();
        }
        listeners = [];

        cmb.disconnect();
    }



    render() {
        return (
            <SafeAreaView style={styles.screenContainer}>
                <View style={styles.headerContainer}>
                    <TouchableOpacity onPress={() => this.props.navigation.dispatch(StackActions.replace('Home'))}>
                        <Image source={require('./assets/images/slide_drawer_icon.png')} style={{ alignSelf: 'flex-start', margin: 25, marginBottom: 0, height: 30, width: 30, resizeMode: 'stretch', }} />
                        {/* <Icon name='view-grid-outline' size={40} color='white' style={{ margin: 15, marginBottom: 0, alignSelf: 'flex-start' }} /> */}
                    </TouchableOpacity>

                    <View style={{ flex: 1, marginLeft: 25, top: 20, width: 500 }}>
                        <Text style={{ fontSize: 32, alignSelf: 'auto', color: 'white', fontFamily: 'OpenSans-SemiBold' }}>Capture</Text>
                    </View>

                </View>

                <View style={styles.formContainer}>

                    <View style={styles.formSectionTop}>
                        <View style={styles.formContainerSectionsText}>
                            <View style={{ flex: 1, alignContent: 'center', alignItems: 'center', maxHeight: '80.5%', height: '80.5%', maxWidth: '45%', width: '45%', justifyContent: 'center' }}>
                                <Text style={{ alignSelf: "center", color: 'rgb(51, 51, 51)', fontSize: 18, textAlign: 'center', fontFamily: 'OpenSans-SemiBold' }}>
                                    {(this.state.connected ? 'Connected :\n' : 'Disconnected :\n') + ((this.state.device == CMBReader.DEVICE_TYPE.MXReader) ? "MX 1xxx" : "Phone Camera")}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.selectDeviceButton} onPress={() => selectDeviceFromPicker()}>
                                <Text style={{ alignSelf: "auto", color: 'white', fontSize: 18, textAlign: 'center', fontFamily: 'OpenSans-SemiBold' }}>Select Device</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.flatListContainer}>
                        <FlatList
                            data={this.state.results}
                            renderItem={({ item }) => <Text style={{ alignSelf: "center", color: 'rgb(51, 51, 51)', fontSize: 18, textAlign: 'center', fontFamily: 'OpenSans-SemiBold' }}>{item.goodRead ? item.symbologyString + ": " + item.readString : 'NO READ'} </Text>}
                            keyExtractor={item => this.state.results.indexOf(item).toString()}
                        />
                    </View>

                    <View style={styles.formSectionBottom}>
                        <TouchableOpacity style={styles.formContainerSections}>
                            <Text style={{ alignSelf: "auto", color: 'white', fontSize: 18, textAlign: 'center', fontFamily: 'OpenSans-SemiBold' }}>Upload</Text>
                        </TouchableOpacity>
                        {this.state.connected ?
                            <TouchableOpacity style={styles.formContainerSections} onPress={() => toggleScanner()}>
                                <Text style={{ alignSelf: "auto", color: 'white', fontSize: 18, textAlign: 'center', fontFamily: 'OpenSans-SemiBold' }}>Scan</Text>
                            </TouchableOpacity>
                            :
                            <TouchableOpacity disabled={true} style={styles.formContainerSectionsDisabled} >
                                <Text style={{ alignSelf: "auto", color: 'rgb(148, 148, 148)', fontSize: 18, textAlign: 'center', fontFamily: 'OpenSans-SemiBold' }}>Scan</Text>
                            </TouchableOpacity>
                        }
                    </View>
                </View>


                {/* <Modal
          animationType='fade'
          transparent={true}
          visible={this.state.modalVisible}
          onRequestClose={() => { this.setState({ modalVisible: false }) }}
        >
          <View style={styles.modalTransparencyContainer}>

            <View style={styles.modalContainer}>
              <View style={{ flex: 1, justifyContent: 'center', flexDirection: 'column' }}>
                <Text style={{ textAlign: 'center', fontSize: 18, fontFamily: 'OpenSans-SemiBold' }}>{this.state.responseMessage_Title}</Text>
              </View>

              <View style={{ flex: 1, justifyContent: 'center', flexDirection: 'column' }}>
                <Text style={{ textAlign: 'center', fontSize: 14, fontFamily: 'OpenSans-Regular', marginHorizontal: '10%' }}>{this.state.responseMessage}</Text>
              </View>



              <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'space-evenly', marginVertical: 5 }}>

                <TouchableOpacity style={styles.modalCancelButton} onPress={() => { this.setState({ modalVisible: false }) }}>
                  <Text style={{ textAlign: 'center', color: "rgb(51, 51, 51)", fontSize: 16, fontFamily: 'OpenSans-SemiBold' }}>Cancel</Text>
                </TouchableOpacity>
              </View>

            </View>

          </View>
        </Modal> */}

            </SafeAreaView >
        );
    }
}

export default App;

const styles = StyleSheet.create({


    screenContainer: {
        flex: 1,
        backgroundColor: 'rgb(12, 35, 64)',
        // alignItems:'center',
        alignContent: 'center',
        justifyContent: "center",
        height: '100%',
        width: '100%',
        margin: 0,
        padding: 0,

    },

    headerContainer: {
        justifyContent: 'center',
        height: '20%',
        // margin: 12.5,
        // marginBottom: 5,
        // borderWidth: 2,
        // borderColor: 'white',
        // borderRadius: 10,
        // backgroundColor: 'white',
        // alignItems: 'center'
    },

    formContainer: {
        flex: 1,
        flexDirection: 'column',
        marginHorizontal: '2.5%',
        marginBottom: '2.5%',
        // top: 1,
        alignItems: 'flex-start',
        borderRadius: 7.5,
        backgroundColor: "#F1F1F0",
        borderWidth: 1,
        borderColor: 'white',
        maxHeight: '77.5%',
        padding: 10,
        justifyContent: 'flex-start'
    },

    flatListContainer: {
        // flex: 1,
        flexDirection: 'row',
        alignContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxHeight: '55%',
        height: '55%',
        justifyContent: 'center',
        backgroundColor: 'white',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: 'rgb(51, 51, 51)',
    },

    selectDeviceButton: {
        flex: 1,
        flexDirection: 'row',
        alignContent: 'center',
        alignItems: 'center',
        maxHeight: '80.5%',
        height: '80.5%',
        maxWidth: '45%',
        width: '45%',
        justifyContent: 'center',
        borderRadius: 7.5,
        borderWidth: 1,
        borderColor: 'rgb(62, 144, 214)',
        marginVertical: 10,
        backgroundColor: 'rgb(62, 144, 214)'
        // padding: '5%',
        // backgroundColor: 'red',
        // justifyContent: 'center',
        // padding: 10,
    },

    formSectionTop: {
        flex: 1,
        flexDirection: 'row',
        alignContent: 'center',
        alignItems: 'flex-start',
        width: '100%',
        maxHeight: '22.5%',
        height: '22.5%',
        justifyContent: 'space-between',
        // backgroundColor: 'green'
    },

    formSectionBottom: {
        flex: 1,
        flexDirection: 'row',
        alignContent: 'center',
        alignItems: 'flex-end',
        width: '100%',
        maxHeight: '22.5%',
        height: '22.5%',
        justifyContent: 'space-between',
        // backgroundColor: 'red'
    },

    formContainerSections: {
        flex: 1,
        flexDirection: 'row',
        alignContent: 'center',
        alignItems: 'center',
        maxHeight: '50%',
        height: '50%',
        maxWidth: '47.5%',
        width: '47.5%',
        justifyContent: 'center',
        borderRadius: 7.5,
        borderWidth: 1,
        borderColor: 'rgb(62, 144, 214)',
        // marginVertical: 10,
        backgroundColor: 'rgb(62, 144, 214)'
        // padding: '5%',
        // backgroundColor: 'red',
        // justifyContent: 'center',
        // padding: 10,
    },

    formContainerSectionsDisabled: {
        flex: 1,
        flexDirection: 'row',
        alignContent: 'center',
        alignItems: 'center',
        maxHeight: '50%',
        height: '50%',
        maxWidth: '47.5%',
        width: '47.5%',
        justifyContent: 'center',
        borderRadius: 7.5,
        borderWidth: 1,
        borderColor: 'rgb(148, 148, 148)',
        // marginVertical: 10,
        backgroundColor: 'rgb(230, 230, 230)'
        // padding: '5%',
        // backgroundColor: 'red',
        // justifyContent: 'center',
        // padding: 10,
    },

    formContainerSectionsText: {
        flex: 1,
        flexDirection: 'row',
        alignContent: 'center',
        alignItems: 'center',
        maxHeight: '65%',
        height: '65%',
        maxWidth: '100%',
        width: '100%',
        justifyContent: 'space-evenly',
        borderRadius: 7.5,
        borderWidth: 1,
        borderColor: 'rgb(51, 51, 51)',
        // marginVertical: 10,
        backgroundColor: 'white'
        // padding: '5%',
        // backgroundColor: 'red',
        // paddingHorizontal: 5,
    },

    modalTransparencyContainer: {
        flex: 1,
        // backgroundColor: 'rgba(255,255,255,0.5)'
        height: Dimensions.get('screen').height,
        width: Dimensions.get('screen').width,
        maxHeight: Dimensions.get('screen').height,
        maxWidth: Dimensions.get('screen').width,
        backgroundColor: 'rgba(196, 196, 196,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    modalContainer: {
        flex: 1,
        flexDirection: 'column',
        // marginHorizontal: '5%',
        // marginTop: '55%',
        width: Dimensions.get('screen').width * 0.80,
        height: Dimensions.get('screen').height * 0.225,

        maxWidth: Dimensions.get('screen').width * 0.80,
        maxHeight: Dimensions.get('screen').height * 0.225,
        // backgroundColor: 'lightgrey',
        backgroundColor: 'rgb(255,255,255)',
        borderWidth: 1,
        borderColor: 'white',
        borderRadius: 10,
        alignContent: 'center',
        justifyContent: 'center',
    },

    modalCancelButton: {
        flex: 1,
        height: "90%",
        maxWidth: '45%',
        // margin: 10,
        // marginRight: 5,
        backgroundColor: 'white',
        borderWidth: 2,
        borderColor: 'lightgrey',
        borderRadius: 10,
        justifyContent: 'center',
        alignSelf: 'center'
    },

    modalOKButton: {
        flex: 1,
        height: "90%",
        maxWidth: '45%',
        // margin: 10,
        // marginLeft: 5,
        backgroundColor: 'rgb(62, 144, 214)',
        borderWidth: 2,
        borderColor: 'rgb(62, 144, 214)',
        borderRadius: 10,
        justifyContent: 'center',
        alignSelf: 'center'

    },
})