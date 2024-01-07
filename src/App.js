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
  const [copiedVisible, setCopiedVisible] = useState(false)
  const [nodeLinkType, setNodeLinkType] = useState("#clearnet")
  const [showPayModal, setShowPayModal] = useState(false)
  const [showProvideNodeInfoModal, setShowProvideNodeInfoModal] = useState(false)
  const [showChannelPendingModal, setShowChannelPendingModal] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [showAwaitingInvoiceModal, setShowAwaitingInvoiceModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showCopiedNode, setShowCopiedNode] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [invoiceToPay, setInvoiceToPay] = useState("")
  const [orderId, setOrderId] = useState(null)
  const [nodeConnectionInfo, setNodeConnectionInfo] = useState("")
  const copyNodeTarget = useRef(null)
  const [swapInfo, setSwapInfo] = useState({
    liquidity_fee_ppm: DEFAULT_LIQUIDITY_FEE_PPM,
    on_chain_bytes_estimate: DEFAULT_VBYTES_PER_SWAP,
    max_swap_amount_sats: DEFAULT_CHANNEL_SIZE_SATS * 10,
    min_swap_amount_sats: 100000,
    available: true
  })
  const [invoiceDetails, setInvoiceDetails] = useState({})
  const [paidOnChainTxid, setPaidOnChainTxid] = useState(null)
  const [isNodeInfoValid, setIsNodeInfoValid] = useState(true)

  const [ready, setReady] = useState(false)

  const defaultChannelSizeSats = DEFAULT_CHANNEL_SIZE_SATS
  const defaultTotalFeeSats = calculateTotalFeeSats(defaultChannelSizeSats, DEFAULT_ON_CHAIN_FEE_RATE_SATS_PER_VBYTE, swapInfo.liquidity_fee_ppm, swapInfo.on_chain_bytes_estimate)
  const [channelParams, setChannelParams] = useState({
    channelRemoteAmountSats: defaultChannelSizeSats,
    feeOnChainSatsPerVbyte: DEFAULT_ON_CHAIN_FEE_RATE_SATS_PER_VBYTE,
    totalFeeSats: defaultTotalFeeSats,
    feeNetPpm: Math.round(defaultTotalFeeSats * 1000000 / DEFAULT_CHANNEL_SIZE_SATS),
    channelRemoteAmountDisplay: DEFAULT_USE_SATS ? defaultChannelSizeSats : defaultChannelSizeSats * 1.0 / SATS_PER_BTC,
    useSatsForDisplay: DEFAULT_USE_SATS
  })
  const [showConfirmLargeChannelModal, setShowConfirmLargeChannelModal] = useState(false)

  useEffect(() => {
    async function fetchSwapInfo() {
      const { data } = await axios.get(`${API_BASE_URL}/v1/swap/info`)
      setSwapInfo(data)
      console.log(channelParams)
      console.log(data)
      const newTotalFeeSats = calculateTotalFeeSats(channelParams.channelRemoteAmountSats, channelParams.feeOnChainSatsPerVbyte, data.liquidity_fee_ppm, data.on_chain_bytes_estimate)
      updateChannelParams({
        newChannelRemoteAmountSats: channelParams.channelRemoteAmountSats,
        newFeeOnChainSatsPerByte: channelParams.feeOnChainSatsPerVbyte,
        newTotalFeeSats,
        newUseSatsForDisplay: channelParams.useSatsForDisplay
      })
      console.log('ready')
      setReady(true)
    }
    fetchSwapInfo()
  }, []);

  const fetchPaymentStatusLoop = async () => {
    if (!showPayModal && !showChannelPendingModal) return
    console.log(`polling for invoice status`)
    let response = null
    try {
      response = await axios.get(`${API_BASE_URL}/v1/lsp/channel?id=${orderId}`)
    } catch (err) {
      console.error(err)
    }
    console.log(response)
    if (response && response.data) {
      if (response.data.channel_open_tx) {
        setPaidOnChainTxid(response.data.channel_open_tx)
        setShowPayModal(false)
        setShowChannelPendingModal(false)
        setShowCompleteModal(true)
      } else if (response.data.state === 'PENDING') {
        setShowPayModal(false)
        setShowChannelPendingModal(true)
      }
    }
  }

  useInterval(fetchPaymentStatusLoop, 1000)

  function calculateLiquidityFee(channelSizeSats, liqFeePpm) {
    return Math.round((channelSizeSats * liqFeePpm / 1000000))
  }
  function calculateChainFee(onChainFeeSatsPerVbyte, bytesPerTx) {
    return onChainFeeSatsPerVbyte * bytesPerTx
  }
  function calculateTotalFeeSats(channelSizeSats, onChainFeeSatsPerVbyte, liqFeePpm, bytesPerTx) {
    const liqFeeSats = calculateLiquidityFee(channelSizeSats, liqFeePpm)
    return calculateChainFee(onChainFeeSatsPerVbyte, bytesPerTx) + liqFeeSats
  }

  if (copiedVisible) {
    setTimeout(() => {
      setCopiedVisible(false)
    }, 1000)
  }

  if (showCopiedNode) {
    setTimeout(() => {
      setShowCopiedNode(false)
    }, 1000)
  }

  function copyNodeInfo() {
    navigator.clipboard.writeText(getNodeUri());
    setShowCopiedNode(true)
  }

  function copyInvoiceToPay() {
    navigator.clipboard.writeText(invoiceToPay)
  }

  function toggleSats() {
    updateChannelParams({
      newChannelRemoteAmountSats: channelParams.channelRemoteAmountSats,
      newFeeOnChainSatsPerByte: channelParams.feeOnChainSatsPerVbyte,
      newTotalFeeSats: channelParams.totalFeeSats,
      newUseSatsForDisplay: !channelParams.useSatsForDisplay
    })
  }

  function satsOrBtcLabel() {
    return channelParams.useSatsForDisplay ? 'Sats' : 'BTC'
  }

  async function initiatePurchase() {
    setIsNodeInfoValid(true)
    if (channelParams.channelRemoteAmountSats > 16777215) {
      setShowConfirmLargeChannelModal(true)
    } else {
      setShowProvideNodeInfoModal(true)
    }
  }

  function handleFeeRateChange(evt) {
    const newFeeOnChainSatsPerByte = evt.target.value
    const newChannelRemoteAmountSats = channelParams.channelRemoteAmountSats
    const newTotalFeeSats = calculateTotalFeeSats(newChannelRemoteAmountSats, newFeeOnChainSatsPerByte, swapInfo.liquidity_fee_ppm, swapInfo.on_chain_bytes_estimate)
    const newUseSatsForDisplay = channelParams.useSatsForDisplay
    updateChannelParams({ newChannelRemoteAmountSats, newFeeOnChainSatsPerByte, newTotalFeeSats, newUseSatsForDisplay })
  }

  function handleChannelSizeChange(evt) {
    const newChannelRemoteAmountSats = parseInt(channelParams.useSatsForDisplay ? evt.target.value: Math.round(evt.target.value * SATS_PER_BTC))
    // console.log(newChannelRemoteAmountSats)
    const newFeeOnChainSatsPerByte = channelParams.feeOnChainSatsPerVbyte
    // console.log(swapInfo)
    const newTotalFeeSats = calculateTotalFeeSats(newChannelRemoteAmountSats, newFeeOnChainSatsPerByte, swapInfo.liquidity_fee_ppm, swapInfo.on_chain_bytes_estimate)
    // console.log(newTotalFeeSats)
    const newUseSatsForDisplay = channelParams.useSatsForDisplay
    updateChannelParams({ newChannelRemoteAmountSats, newFeeOnChainSatsPerByte, newTotalFeeSats, newUseSatsForDisplay })
    console.log(newChannelRemoteAmountSats)
  }

  function getNodeUri() {
    return CLEARNET_NODE_URI
  }

  function updateChannelParams({ newChannelRemoteAmountSats, newFeeOnChainSatsPerByte, newTotalFeeSats, newUseSatsForDisplay }) {
    setChannelParams({
      channelRemoteAmountSats: newChannelRemoteAmountSats,
      feeOnChainSatsPerVbyte: newFeeOnChainSatsPerByte,
      totalFeeSats: newTotalFeeSats,
      feeNetPpm: Math.round(newTotalFeeSats * 1000000 / newChannelRemoteAmountSats),
      channelRemoteAmountDisplay: newUseSatsForDisplay ? newChannelRemoteAmountSats : newChannelRemoteAmountSats * 1.0 / SATS_PER_BTC,
      useSatsForDisplay: newUseSatsForDisplay
    })
    console.log(channelParams)
  }

  function validateIpPort(ipPort) {
    // Split the string into separate IP and port components
    const parts = ipPort.split(':');
    if (parts.length !== 2) {
      // If there are not exactly 2 parts, it's not a valid IP:port string
      return false;
    }
    const ip = parts[0];
    const port = parts[1];
    // Check if the IP is an onion address
    if (ip.endsWith('.onion')) {
      // Make sure the onion address is a valid base32 string
      const onionRegex = /^[a-z2-7]*\.onion$/;
      if (!onionRegex.test(ip)) {
        return false;
      }
    } else if (!validator.isIP(ip)) {
      // Check if the IP is a valid IPv4 or IPv6 address
      return false;
    }
    // Check if the port is a valid number within the allowed range
    if (!validator.isInt(port, { min: 1, max: 65535 })) {
      return false;
    }
    // If all checks pass, the IP:port is valid
    return true;
  }

  function handleNodeConnectionInfoChange(evt) {
    const newConnectionInfo = evt.target.value
    if (newConnectionInfo === '') {
      setIsNodeInfoValid(true)
      return
    }
    const [pubkey, hostport] = newConnectionInfo.split('@')
    if (!pubkey || !pubkey.match(/^[0-9a-fA-F]*/)) {
      setIsNodeInfoValid(false)
      return
    }
    if (!hostport || !validateIpPort(hostport)) {
      setIsNodeInfoValid(false)
      return
    }
    setIsNodeInfoValid(true)
    setNodeConnectionInfo(newConnectionInfo)
  }

  async function handleConfirmPurchase() {
    setShowConfirmationModal(false)
    setShowAwaitingInvoiceModal(true)
    let response
    try {
      response = await axios.post(`${API_BASE_URL}/v1/lsp/channel`,
        {
          node_connection_info: nodeConnectionInfo,
          remote_balance: channelParams.channelRemoteAmountSats,
          on_chain_fee_rate: parseInt(channelParams.feeOnChainSatsPerVbyte)
        })
    } catch (err) {
      setShowAwaitingInvoiceModal(false)
      setShowErrorModal(true)
      return
    }
    console.log(response)
    const invoice = response.data.ln_invoice
    setInvoiceToPay(invoice)
    setOrderId(response.data.order_id)
    // const parsedInvoice = parsePaymentRequest({ request: invoice })
    // console.log(parsedInvoice)
    // Note: this is a hack because we had trouble decoding invoice in browser, we are just
    // assuming the expiry is 2 minutes from now.
    setInvoiceDetails({
      // description: parsedInvoice.description,
      expiresAt: Date.now() + INVOICE_EXPIRY_MS//new Date(parsedInvoice.expires_at)
    })
    setShowAwaitingInvoiceModal(false)
    setShowPayModal(true)
    // TODO: pay modal needs to poll until invoice is paid
    // TODO: pay modal should show invoice expiration countdown
    // TODO: pay modal should show QR code for invoice
  }

  function handleConfirmNodeInfo() {
    setShowProvideNodeInfoModal(false)
    setShowConfirmationModal(true)
  }

  function channelSummary() {
    return (
      <>
        <b>Channel Size:</b> {channelParams.channelRemoteAmountSats.toLocaleString('en-US')} sats<br /><br />
        <b>On-Chain Fee Rate:</b> {channelParams.feeOnChainSatsPerVbyte} sat/vbyte<br /><br />
        <b>Total Fee:</b> {channelParams.totalFeeSats.toLocaleString('en-US')} sats ({channelParams.feeNetPpm.toLocaleString('en-US')} ppm)<br /><br />
        <b>Node Info:</b> {nodeConnectionInfo}<br /><br />
        <b>Details:</b> The channel will remain open for at least one month.
      </>
    )
  }

  const countdownRenderer = ({ hours, minutes, seconds, completed }) => {
    if (completed) {
      // Render a completed state
      return <span>the invoice has expired</span>;
    } else {
      // Render a countdown
      return <span>expires in: {hours > 0 ? `${hours}h` : ''} {minutes > 0 ? `${minutes}m` : ''} {seconds}s</span>;
    }
  };

  function isValidChannelParams() {
    return channelParams.channelRemoteAmountSats >= MIN_CHANNEL_SIZE_SATS
  }

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
            <Card.Header style={{ borderBottom: '1px solid gray', marginBottom: '20px' }} className="card-header py-4">
              <Card.Title>
                <b>Buy a Channel</b>
              </Card.Title>
            </Card.Header>
            {ready ?
              <>
                <Card.Body className="d-flex flex-column justify-content-center">
                  <InputGroup hasValidation className="input-group mb-3 w-100 swap-option">
                    <InputGroup.Text className="w-25 in-text">Size</InputGroup.Text>
                    <Form.Control type="number" className="in-text" step={channelParams.useSatsForDisplay ? 1000000 : 0.01} onChange={handleChannelSizeChange} value={channelParams.channelRemoteAmountDisplay} required isInvalid={!isValidChannelParams()} />
                    <InputGroup.Text className="input-group-text hover in-text" onClick={toggleSats}>⚡ {satsOrBtcLabel()}</InputGroup.Text>
                    <Form.Control.Feedback type="invalid">
                      {
                        `Channel size must be at least ${MIN_CHANNEL_SIZE_SATS.toLocaleString()} sats.`
                      }
                    </Form.Control.Feedback>
                  </InputGroup>
                  <Form.Label className="swap-option"><div className="small-text" id="fee-info">{channelParams.feeOnChainSatsPerVbyte} sat/vbyte on-chain fee rate</div></Form.Label>
                  <Form.Range className="swap-option" min="30" defaultValue={DEFAULT_ON_CHAIN_FEE_RATE_SATS_PER_VBYTE} onChange={handleFeeRateChange} />
                  <Form.Label className="swap-option"><div className="small-text" id="fee-info">{channelParams.totalFeeSats.toLocaleString()} total sat fee ({Math.round(channelParams.feeNetPpm).toLocaleString()} ppm)</div></Form.Label>
                  <br />

                  <Button className="w-50 centered" disabled={!isValidChannelParams()} onClick={initiatePurchase}>Purchase Channel</Button>
                </Card.Body>
                <br />
              </>
              :
              <>
                <br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
              </>
            }
          </Card>
          <br />
          <br />
          <Card id="node-section" className="section" bg="dark" text="white">
            <Card.Header style={{ borderBottom: '1px solid gray' }}>
              <Card.Title className="py-3">
                <b>Connect</b> with <b>Deezy</b>:
              </Card.Title>
              <Nav variant="pills" defaultActiveKey={nodeLinkType} onSelect={(s) => setNodeLinkType(s)}>
                <Nav.Item>
                  <Nav.Link eventKey="#clearnet">Clearnet</Nav.Link>
                </Nav.Item>
              </Nav>
            </Card.Header>
            <Card.Body>
              <Card.Text className="node-text">
                {getNodeUri()}
                <br />
                <br />
                <Button ref={copyNodeTarget} onClick={copyNodeInfo} variant="outline-primary"><FaRegCopy /> Copy</Button>
              </Card.Text>
            </Card.Body>
          </Card>
          <br />
          <br />
          <br />
          <Modal show={showProvideNodeInfoModal} onHide={() => setShowProvideNodeInfoModal(false)} className="modal py-5">
            <Modal.Header closeButton className="modal-header p-4" >
              <Modal.Title>Your Node's Info</Modal.Title>
            </Modal.Header>
            <Modal.Body className="modal-body p-4">
              <div>Enter your node's connection info:</div><br />
              <InputGroup className="mb-3">
                <Form.Control onChange={handleNodeConnectionInfoChange}
                  placeholder="pubkey@host:port"
                  aria-label="paste node info here"
                  aria-describedby="basic-addon2"
                  isInvalid={!isNodeInfoValid}
                  autoFocus
                />
                <Form.Control.Feedback type="invalid">
                  <br />invalid connection info. must be pubkey@host:port
                </Form.Control.Feedback>
              </InputGroup>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowProvideNodeInfoModal(false)}>
                cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmNodeInfo} disabled={!true}>
                next
              </Button>
            </Modal.Footer>
          </Modal>
          <Modal show={showConfirmLargeChannelModal} onHide={() => setShowConfirmLargeChannelModal(false)} className="py-5">
            <Modal.Header closeButton className="p-4">
              <Modal.Title>Warning: Large Channel</Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-5 py-3">
              <p>You are requesting a large channel. Your node cannot accept it unless you have configured it specifically to accept large channels</p>
              <p>Please confirm you have configured your node to accept large channels</p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowConfirmLargeChannelModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => {
                setShowConfirmLargeChannelModal(false);
                setShowProvideNodeInfoModal(true);
              }
              }>
                Yes I Accept Large Channels
              </Button>
            </Modal.Footer>
          </Modal>
          <Modal show={showConfirmationModal} onHide={() => setShowConfirmationModal(false)} className="py-5">
            <Modal.Header closeButton className="p-4">
              <Modal.Title>Confirm Details?</Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-5 py-3">
              {channelSummary()}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowConfirmationModal(false)}>
                cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmPurchase}>
                confirm
              </Button>
            </Modal.Footer>
          </Modal>
          <Modal show={showAwaitingInvoiceModal} onHide={() => setShowAwaitingInvoiceModal(false)} className="py-5">
            <Modal.Header closeButton className="p-4">
              <Modal.Title>Requesting channel...</Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-5 py-3 center-contents">
              <br /><br />
              <TailSpin stroke="#000000" speed={.75} />
              <br /><br /><br />
            </Modal.Body>
          </Modal>
          <Modal show={showPayModal} onHide={() => setShowPayModal(false)} className="py-5">
            <Modal.Header closeButton className="p-4">
              <Modal.Title>Pay invoice to get channel</Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-5 py-3 center-contents modal-body">
              <QRCodeSVG size="240" value={`lightning:${invoiceToPay}`} />
              <br /><br />
              <Countdown date={new Date(invoiceDetails.expiresAt)} renderer={countdownRenderer} />
              <br /><br />
              <Button onClick={copyInvoiceToPay} variant="outline-primary"><FaRegCopy /> copy</Button>
              <br /><br />
              <span className="small-text">{invoiceToPay}</span>
            </Modal.Body>
          </Modal>
          <Modal show={showChannelPendingModal} onHide={() => setShowChannelPendingModal(false)} className="py-5">
            <Modal.Header closeButton className="p-4">
              <Modal.Title>Payment accepted</Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-5 py-3 center-contents">
              Channel will be opened shortly. Please wait...
              <br /><br />
              <TailSpin stroke="#000000" speed={.75} />
              <br /><br />
              You can track the status of your channel <a href={`${API_BASE_URL}/v1/lsp/channel?id=${orderId}`} target="_blank">here</a>.
              <br /><br />
            </Modal.Body>
          </Modal>
          <Modal show={showCompleteModal} onHide={() => setShowCompleteModal(false)} className="py-5">
            <Modal.Header closeButton className="p-4">
              <Modal.Title>Channel is opening</Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-5 py-3 center-contents modal-body">
              <div>
                <Image id="check-image" src={GreenCheck} alt="green check" />
              </div>
              <br />
              txid: <a className="small-text" target="_blank" href={`https://mempool.space/${TESTNET ? 'testnet/' : ''}tx/${paidOnChainTxid}`}>{paidOnChainTxid}</a>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="primary" onClick={() => setShowCompleteModal(false)}>
                done
              </Button>
            </Modal.Footer>
          </Modal>
          <Modal show={showErrorModal} onHide={() => setShowErrorModal(false)} className="py-5">
            <Modal.Header closeButton className="p-4">
              <Modal.Title>Error</Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-5 py-3 center-contents">
              Oops something went wrong
            </Modal.Body>
          </Modal>
        </Container>
        <br />
        <br /><br /><br />
      </Container>
    </>
  )
}

export default App;
