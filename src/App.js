import React, { useState, useRef, useEffect } from 'react';
import './App.css';

import Container from 'react-bootstrap/Container';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Modal from 'react-bootstrap/Modal';
import { FaRegCopy } from 'react-icons/fa';
import InputGroup from 'react-bootstrap/InputGroup';
import { TailSpin } from 'react-loading-icons'
import { QRCodeSVG } from 'qrcode.react';
import Countdown from 'react-countdown';
import useInterval from 'react-useinterval';
import Image from 'react-bootstrap/Image';
import GreenCheck from './assets/images/green-check.gif';
import DeezyLogo from './assets/images/Logo-No-Text.svg';

// const { parsePaymentRequest } = require('invoices')
const axios = require('axios').default;
const validator = require('validator')

const TESTNET = false
const API_BASE_URL = `https://api${TESTNET ? '-testnet' : ''}.deezy.io`

const MIN_CHANNEL_SIZE_SATS = TESTNET ? 50000 : 400000
const DEFAULT_LIQUIDITY_FEE_PPM = 1500
const DEFAULT_VBYTES_PER_SWAP = 300
const SATS_PER_BTC = 100000000
const DEFAULT_CHANNEL_SIZE_SATS = 16700000
const DEFAULT_ON_CHAIN_FEE_RATE_SATS_PER_VBYTE = 100
const DEFAULT_USE_SATS = false
const INVOICE_EXPIRY_MS = 1000 * 60 * 60 * 3 // 3 hr
const NODE_ID = "024bfaf0cabe7f874fd33ebf7c6f4e5385971fc504ef3f492432e9e3ec77e1b5cf"
const CLEARNET_NODE_URI = `${NODE_ID}@52.1.72.207:9735`

const App = () => {
  return (
    <>
      <Navbar bg="dark" variant="dark">
        <Container>
          <Navbar.Brand style={{ margin: 'auto' }} onClick={() => window.open('https://deezy.io', '_self')}>
            <img
              alt=""
              src={DeezyLogo}
              height="100"
              className="align-top my-2"
            />{' '}
          </Navbar.Brand>
        </Container>
      </Navbar>
      <Container fluid className="main-container d-flex flex-column text-center align-items-center justify-content-center pt-5">
        <Container fluid>
          <br />
          <Card id="swap-section" className="section" fluid bg="dark" text="white" variant="dark">
            <Card.Header style={{  marginBottom: '20px' }} className="card-header py-4">
              <Card.Title>
                <b>Sorry, Channel Purchasing is Disabled</b>
              </Card.Title>
            </Card.Header>
          </Card>
        </Container>
        <br />
        <br /><br /><br />
      </Container>
    </>
  )
}

export default App;
