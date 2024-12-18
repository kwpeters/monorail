/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/naming-convention */
import React from "react";
import { Text, Box, Newline } from "ink";


const { useState, useEffect } = React;

const cryptoData = [
    {
        "id":                               "bitcoin",
        "symbol":                           "btc",
        "name":                             "Bitcoin",
        "image":                            "https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1547033579",
        "current_price":                    20503,
        "market_cap":                       391328171045,
        "market_cap_rank":                  1,
        "fully_diluted_valuation":          430879029036,
        "total_volume":                     28989375583,
        "high_24h":                         20888,
        "low_24h":                          19210.24,
        "price_change_24h":                 1071.93,
        "price_change_percentage_24h":      5.51665,
        "market_cap_change_24h":            20586966613,
        "market_cap_change_percentage_24h": 5.55292,
        "circulating_supply":               19072387,
        "total_supply":                     21000000,
        "max_supply":                       21000000,
        "ath":                              69045,
        "ath_change_percentage":            -70.30681,
        "ath_date":                         "2021-11-10T14:24:11.849Z",
        "atl":                              67.81,
        "atl_change_percentage":            30134.32591,
        "atl_date":                         "2013-07-06T00:00:00.000Z",
        "roi":                              null,
        "last_updated":                     "2022-06-20T13:14:25.135Z"
    },
    {
        "id":                               "litecoin",
        "symbol":                           "ltc",
        "name":                             "Litecoin",
        "image":                            "https://assets.coingecko.com/coins/images/2/large/litecoin.png?1547033580",
        "current_price":                    52.28,
        "market_cap":                       3694703518,
        "market_cap_rank":                  19,
        "fully_diluted_valuation":          4399514470,
        "total_volume":                     1125888842,
        "high_24h":                         55.95,
        "low_24h":                          50.1,
        "price_change_24h":                 2.19,
        "price_change_percentage_24h":      4.3652,
        "market_cap_change_24h":            162264508,
        "market_cap_change_percentage_24h": 4.59355,
        "circulating_supply":               70543033.2334713,
        "total_supply":                     84000000,
        "max_supply":                       84000000,
        "ath":                              410.26,
        "ath_change_percentage":            -87.23953,
        "ath_date":                         "2021-05-10T03:13:07.904Z",
        "atl":                              1.15,
        "atl_change_percentage":            4456.85587,
        "atl_date":                         "2015-01-14T00:00:00.000Z",
        "roi":                              null,
        "last_updated":                     "2022-06-20T13:12:59.334Z"
    }
];


export default function Table(): React.JSX.Element {

    const [data, setData] = useState<typeof cryptoData>([]);

    useEffect(() => {
        setData(cryptoData);
    }, []);

    return (
        <Box borderStyle='single' padding={2} flexDirection='column'>
            <Box>
                <Box width='25%'><Text>COIN</Text></Box>
                <Box width='25%'><Text>PRICE (USD)</Text></Box>
                <Box width='25%'><Text>24 HOUR CHANGE</Text></Box>
                <Box width='25%'><Text>ALL TIME HIGH</Text></Box>
            </Box>
            <Newline />
            {
                data.map(({ id, name, current_price, price_change_percentage_24h, ath }) => (
                    <Box key={id}>
                        <Box width='25%'><Text>{name}</Text></Box>
                        <Box width='25%'><Text>{current_price}</Text></Box>
                        <Box width='25%'><Text>{price_change_percentage_24h}</Text></Box>
                        <Box width='25%'><Text>{ath}</Text></Box>
                    </Box>
                ))
            }
        </Box>
    );
}
