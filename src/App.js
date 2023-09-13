import { useState, useEffect } from "react";
import {defaultData, tradeData} from './constants/data'
import axios from "axios";
import { OpenSeaStreamClient } from '@opensea/stream-js';
import { WebSocket } from 'ws';

import ReactTable from "react-table";  
import "react-table/react-table.css" 

import "./App.css"


const App = () => {

  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  // const [updateTime, setUpdateTime] = useState(Math.floor(new Date().getTime()/1000));
  const [updateTime, setUpdateTime] = useState(0);
  const [quantity, setQuantity] = useState(2);
  const [duration, setDuration] = useState(10);
  const [buyerInfo, setBuyerInfo] = useState({});

  const [addTime, setAddTime] = useState(0);

  let updateState = false;

  useEffect(() => {
    let curTime = new Date()
    console.log("update first")
    setUpdateTime(Math.floor(curTime.getTime()/1000))
  }, [])

  useEffect(() => {
    let timerID = setInterval( () => {
      let curTime = new Date()
      console.log("refrest start", curTime, duration)
      setUpdateTime(Math.floor(curTime.getTime()/1000))
    }, 1000*60*duration/2 );
    return () => clearInterval(timerID) 
  }, [duration]);

// Get new trade event every 30 seconds.
  useEffect(() => {
    let timerID = setInterval( async () => {
      const curTimestamp = Math.floor(new Date().getTime()/1000) - 120;
      // setAddTime(curTimestamp)
      let buyer_list = buyerInfo;
      let temp = Object.keys(buyer_list)
      console.error("30s event occur", curTimestamp, updateTime, updateState,  temp)
      if(curTimestamp > (updateTime+30) && !updateState && buyer_list) {
        console.log("30s add event start")
        await getSoldEvent(curTimestamp-30, curTimestamp, buyer_list);
        console.log("30s event after", Object.keys(buyer_list) )

        // setBuyerInfo(buyer_list);
        // updateTable();
      }


    }, 1000*30 );
    return () => clearInterval(timerID) 
  })


  // useEffect(() => {
  //   let timerID = setInterval( async () => {
  //     const curTimestamp = Math.floor(new Date().getTime()/1000) - 120;
  //     // curTimestamp = curTimestamp - 120;
  //     let buyer_list = buyerInfo;
  //     let temp = Object.keys(buyer_list)
  //     console.log("30s event", curTimestamp, updateTime, updateState, temp)
  //     if(curTimestamp > (updateTime+30) && !updateState && buyer_list) {
  //       await getSoldEvent(curTimestamp-30, curTimestamp, buyer_list);
  //       console.log("30s event after", Object.keys(buyer_list) )

  //       setBuyerInfo(buyer_list);
  //       updateTable();
  //     }
  //   }, 1000*30 );
  // return () => clearInterval(timerID) 
  // }, [buyerInfo]);


  useEffect(() => {
    ( async () => {
      let cursor = '';
      let buyer_list = {};
      let bulk_buyer = [];
      console.log("update time", updateTime)
      const start_time = updateTime - 60*duration
      const end_time = updateTime

      console.log("occure time", start_time, end_time)
      const default_api_url = 'https://api.opensea.io/api/v1/events?event_type=successful&occurred_after=' + start_time + '&occurred_before=' + end_time + '&cursor=';

      if(updateState)
        return;

      while(cursor !== null) {
        updateState = true;
        const api_url = default_api_url + cursor;
        const res = await axios.get(api_url, {
          headers: {
            'Accept' : 'application/json',
            'X-API-KEY' : '47737e2229ae45d9a106a1ab71c84ca6'
          }
        });
        console.log("api res", res.data)
        const res_data = res.data;

        if(res_data['next'] === undefined) {
          cursor = null;
          continue;
        }
        cursor = res_data['next'];

        let asset_events = res_data['asset_events'];

        asset_events.map((event, i) => {
          let buyer_addr = event.winner_account.address;
          let trade_collection = event.collection_slug;
          let trade_time = event.created_date;
          let buyer_info;
    
          if(typeof(buyer_list[buyer_addr]) != Object) {
            buyer_list[buyer_addr] = {
              'Ethereum' : {},
              'Polygon' : {},
              'Klaytn' : {},
              'Solana' : {}
            }
          }

          let chain_name;
          let event_asset = event.asset ? event.asset : event.asset_bundle.assets[0];

          if(event_asset.permalink.includes('assets/ethereum'))
            chain_name = 'Ethereum';
          if(event_asset.permalink.includes('assets/matic'))
            chain_name = 'Polygon';
          if(event_asset.permalink.includes('assets/klaytn'))
            chain_name = 'Klaytn';
          if(event_asset.permalink.includes('assets/solana'))
            chain_name = 'Solana';

          if(typeof(buyer_list[buyer_addr][chain_name][trade_collection]) != Object) {
            buyer_list[buyer_addr][chain_name][trade_collection] = {'tokens': [], 'trade_time': '' }
          } 

          if(event.asset) {
            buyer_list[buyer_addr][chain_name][trade_collection]['tokens'].push(event.asset.token_id);
            buyer_list[buyer_addr][chain_name][trade_collection]['trade_time'] = event.created_date;
          }
          if(event.asset_bundle) {
            let assets_bundle = event.asset_bundle.assets
            assets_bundle.map((asset) => {
              buyer_list[buyer_addr][chain_name][trade_collection]['tokens'].push(asset.token_id)
            })
            buyer_list[buyer_addr][chain_name][trade_collection]['trade_time'] = event.created_date;

          }

          if( buyer_list[buyer_addr][chain_name][trade_collection]['tokens'].length >= quantity) {
            bulk_buyer.push({
              "collections": trade_collection,
              "chain": chain_name,
              "networth": 0,
              "wallet": buyer_addr,
              "spent": 0,
              "volume": 0,
              "time": event.created_date
            })
          }

          // console.log(i, event.winner_account.address, event.collection_slug, event.created_date )
        })
    
      }

      console.log("buyer list", buyer_list)

      setBuyerInfo(buyer_list)

      setData(bulk_buyer)

      updateState = false;


    })();
  }, [updateTime]);

  const onChangeQuantity = (e) => {
    let newQuantity = parseInt(e.target.value)
    let bulk_buyer = [];
    
    Object.keys(buyerInfo).map( (wallet, index) => {
      let wallet_trade_info = buyerInfo[wallet];
      Object.keys(wallet_trade_info).map( (chain) => {
        let chain_trade = wallet_trade_info[chain];
        Object.keys(chain_trade).map( collection => {
          if(chain_trade[collection]['tokens'].length >= newQuantity) {
            bulk_buyer.push({
              "collections": collection, 
              "chain": chain,
              "networth": 0,
              "wallet": wallet,
              "spent": 0,
              "volume": 0,
              "time": chain_trade[collection]['trade_time']
            })
          }
        })
      });
    });

    console.log("new buyer", newQuantity, bulk_buyer, buyerInfo)

    setQuantity(newQuantity)
    setData(bulk_buyer)

  }

  const updateTable = () => {
    console.log("update table input",  Object.keys(buyerInfo))
    let bulk_buyer = [];
    Object.keys(buyerInfo).map( (wallet, index) => {
      let wallet_trade_info = buyerInfo[wallet];
      Object.keys(wallet_trade_info).map( (chain) => {
        let chain_trade = wallet_trade_info[chain];
        Object.keys(chain_trade).map( collection => {
          if(chain_trade[collection]['tokens'].length >= quantity) {
            bulk_buyer.push({
              "collections": collection,
              "chain": chain,
              "networth": 0,
              "wallet": wallet,
              "spent": 0,
              "volume": 0,
              "time": chain_trade[collection]['trade_time']
            })
          }
        })
      });
    });
    console.log("update table",quantity, bulk_buyer, buyerInfo)
    setData(bulk_buyer)
  }

  const onChangeDuration = (e) => {
    console.log("duration changed")
    let newDuration = parseInt(e.target.value)
    setDuration(newDuration)
    setUpdateTime(Math.floor(new Date().getTime()/1000))
  }


  const getSoldEvent = async (start_time, end_time,  cur_buyer_list) => {
    let cursor = '';
    let buyer_list = cur_buyer_list;
    console.log("occure time", start_time, end_time, buyer_list)
    const default_api_url = 'https://api.opensea.io/api/v1/events?event_type=successful&occurred_after=' + start_time + '&occurred_before=' + end_time + '&cursor=';

    while(cursor !== null) {
      updateState = true;
      const api_url = default_api_url + cursor;
      const res = await axios.get(api_url, {
        headers: {
          'Accept' : 'application/json',
          'X-API-KEY' : '47737e2229ae45d9a106a1ab71c84ca6'
        }
      });
      console.log("api res", res.data)
      const res_data = res.data;

      if(res_data['next'] === undefined) {
        cursor = null;
        continue;
      }
      cursor = res_data['next'];

      let asset_events = res_data['asset_events'];

      asset_events.map((event, i) => {
        let buyer_addr = event.winner_account.address;
        let trade_collection = event.collection_slug;
        let trade_time = event.created_date;
        let buyer_info;
  
        if(typeof(buyer_list[buyer_addr]) != Object) {
          buyer_list[buyer_addr] = {
            'Ethereum' : {},
            'Polygon' : {},
            'Klaytn' : {},
            'Solana' : {}
          }
        }

        let chain_name;
        let event_asset = event.asset ? event.asset : event.asset_bundle.assets[0];

        if(event_asset.permalink.includes('assets/ethereum'))
          chain_name = 'Ethereum';
        if(event_asset.permalink.includes('assets/matic'))
          chain_name = 'Polygon';
        if(event_asset.permalink.includes('assets/klaytn'))
          chain_name = 'Klaytn';
        if(event_asset.permalink.includes('assets/solana'))
          chain_name = 'Solana';

        if(typeof(buyer_list[buyer_addr][chain_name][trade_collection]) != Object) {
          buyer_list[buyer_addr][chain_name][trade_collection] = {'tokens': [], 'trade_time': '' }
        } 

        if(event.asset) {
          buyer_list[buyer_addr][chain_name][trade_collection]['tokens'].push(event.asset.token_id);
          buyer_list[buyer_addr][chain_name][trade_collection]['trade_time'] = event.created_date;
        }
        if(event.asset_bundle) {
          let assets_bundle = event.asset_bundle.assets
          assets_bundle.map((asset) => {
            buyer_list[buyer_addr][chain_name][trade_collection]['tokens'].push(asset.token_id)
          })
          buyer_list[buyer_addr][chain_name][trade_collection]['trade_time'] = event.created_date;
        }
      })
    }

    setBuyerInfo(buyer_list)
    updateTable();

  }


  const onFilteredChangeCustom = (value, accessor) => {
    let insertNewFilter = 1;
    let filterData = filtered;
    console.log("val ", value);
    console.log("accessor ", accessor);
    if (filterData.length) {
      filterData.forEach((filter, i) => {
        if (filter["id"] === accessor) {
          if (value === "" || !value.length) filterData.splice(i, 1);
          else filter["value"] = value;
          insertNewFilter = 0;
        }
      });
    }

    if (insertNewFilter) {
      filterData.push({ id: accessor, value: value });
    }

    setFiltered(filterData);

  };

  return (
    <div>
      <br/>
      <br/>

      <div style={{padding:'15px'}}>
        Quantity <input type="number" id="quantity" name="quantity" min="1" max="10" defaultValue={quantity} onChange={onChangeQuantity}></input>

        <div className="btn-group" style={{float: 'right'}}>
          <button type="button" className={duration == 5? 'btn btn-default btn-active':'btn btn-default '} value="5" onClick={onChangeDuration}>5M</button>
          <button type="button" className={duration == 10? 'btn btn-default btn-active':'btn btn-default '} value="10" onClick={onChangeDuration}>10M</button>
          <button type="button" className={duration == 15? 'btn btn-default btn-active':'btn btn-default'} value="15" onClick={onChangeDuration}>15M</button>
          <button type="button" className={duration == 30? 'btn btn-default btn-active':'btn btn-default'} value="30" onClick={onChangeDuration}>30M</button>
          <button type="button" className={duration == 60? 'btn btn-default btn-active':'btn btn-default'} value="60" onClick={onChangeDuration}>1H</button>
        </div>
      </div>


      <ReactTable
        data={data}
        filterable
        getTheadFilterThProps={() => {
          return {
            style: { overflow: "visible" }
          };
        }}
        filtered={filtered}
        onFilteredChange={(filtered, column, value) => {
          onFilteredChangeCustom(value, column.id || column.accessor);
        }}
        defaultFilterMethod={(filter, row, column) => {
          const id = filter.pivotId || filter.id;
          if (typeof filter.value === "object") {
            return row[id] !== undefined
              ? filter.value.indexOf(row[id]) > -1
              : true;
          } else {
            return row[id] !== undefined
              ? String(row[id]).indexOf(filter.value) > -1
              : true;
          }
        }}
        columns={[
          {
            Header: "Collections",
            accessor: "collections",
            Cell: ({value}) =>  <a href={'https://opensea.io/collection/' + value} target='_blank'>{value}</a>
          },
          {
            Header: "Chain",
            accessor: "chain"
          },
          {
            Header: "Wallet Networth",
            accessor: "networth"
          },
          {
            Header: "Wallet",
            accessor: "wallet",
            Cell: ({value}) =>  <a href={'https://opensea.io/' + value} target='_blank'>{value}</a>
          },
          {
            Header: "Total Spent",
            accessor: "spent",
          },
          {
            Header: "Volume",
            accessor: "volume",
          },
          {
            Header: "Time",
            accessor: "time",
          }
        ]}
        defaultPageSize={10}
        className="-striped -highlight"
      />
      <br />
    </div>
  );
};

export default App;