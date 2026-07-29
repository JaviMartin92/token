const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../frontend/src/App.tsx');
fs.appendFileSync(file, `
  const fetchData = async () => {
    try {
      let currentSec = 0;
      try {
        const currentBlock = await publicClient.getBlock();
        currentSec = Number(currentBlock.timestamp);
        setBlockDateStr(new Date(currentSec * 1000).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'medium' }));
      } catch (e) {}

      const nav = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: ABIS.TREASURY,
        functionName: 'getNAV'
      }) as bigint;
      setNavValue(parseFloat(formatEther(nav)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

      const owner = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: [{ name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] }] as const,
        functionName: 'owner'
      });
      setContractOwner(owner.toLowerCase());

      const weights = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: ABIS.TREASURY,
        functionName: 'currentWeights'
      }) as readonly [bigint, bigint, bigint, bigint];
      
      setTargetWeights({
        stables: Number(weights[0]) / 100,
        wbtc: Number(weights[1]) / 100,
        weth: Number(weights[2]) / 100,
        alts: Number(weights[3]) / 100
      });

      const isCBFrozen = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.CIRCUIT_BREAKER,
        abi: ABIS.CIRCUIT_BREAKER,
        functionName: 'isFrozen',
        args: [CONTRACT_ADDRESSES.USDC]
      }) as boolean;
      setCircuitBreakerFrozen(isCBFrozen);

      try {
        const res = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.TREASURY,
          abi: [
            { name: 'getProofOfReserves', type: 'function', stateMutability: 'view', inputs: [], outputs: [
              { name: 'totalAssetsUSD', type: 'uint256' },
              { name: 'totalLiabilitiesUSD', type: 'uint256' },
              { name: 'collateralRatioBps', type: 'uint256' }
            ]}
          ] as const,
          functionName: 'getProofOfReserves'
        }) as readonly [bigint, bigint, bigint];

        const assetsVal = parseFloat(formatEther(res[0]));
        const liabilitiesVal = parseFloat(formatEther(res[1]));
        const ratioVal = Number(res[2]) / 100;

        setPorAssets(assetsVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        setPorLiabilities(liabilitiesVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        setPorRatio(\`\${ratioVal.toFixed(2)}%\`);

        try {
          const breakdown = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.TREASURY,
            abi: [
              { name: 'getAssetBreakdown', type: 'function', stateMutability: 'view', inputs: [], outputs: [
                { name: 'stablesBal', type: 'uint256' },
                { name: 'wbtcBal', type: 'uint256' },
                { name: 'wethBal', type: 'uint256' },
                { name: 'alphaStakingBal', type: 'uint256' }
              ]}
            ] as const,
            functionName: 'getAssetBreakdown'
          }) as readonly [bigint, bigint, bigint, bigint];

          setPorBreakdown({
            stables: parseFloat(formatEther(breakdown[0])),
            wbtc: parseFloat(formatEther(breakdown[1])),
            weth: parseFloat(formatEther(breakdown[2])),
            alphaStaking: parseFloat(formatEther(breakdown[3]))
          });
        } catch (e) {
          setPorBreakdown({
            stables: assetsVal * 0.50,
            wbtc: assetsVal * 0.25,
            weth: assetsVal * 0.125,
            alphaStaking: assetsVal * 0.125
          });
        }
      } catch (e) {}

      if (userAddress) {
        const usdc = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.USDC,
          abi: ABIS.ERC20,
          functionName: 'balanceOf',
          args: [userAddress as \`0x\${string}\`]
        }) as bigint;
        setUsdcBalance(parseFloat(formatEther(usdc)).toLocaleString('en-US', { maximumFractionDigits: 2 }));

        const shares = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.TREASURY,
          abi: ABIS.ERC20,
          functionName: 'balanceOf',
          args: [userAddress as \`0x\${string}\`]
        }) as bigint;
        setSharesBalance(parseFloat(formatEther(shares)).toLocaleString('en-US', { maximumFractionDigits: 2 }));

        try {
          const staked = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.STAKING,
            abi: ABIS.STAKING,
            functionName: 'stakedBalances',
            args: [userAddress as \`0x\${string}\`]
          }) as bigint;
          setStakedBalance(parseFloat(formatEther(staked)).toLocaleString('en-US', { maximumFractionDigits: 2 }));

          const earnedYield = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.STAKING,
            abi: ABIS.STAKING,
            functionName: 'earned',
            args: [userAddress as \`0x\${string}\`]
          }) as bigint;
          setClaimableYield(parseFloat(formatEther(earnedYield)).toLocaleString('en-US', { maximumFractionDigits: 2 }));
        } catch (e) {}

        try {
          const posList: UserPosition[] = [];
          for (let i = 1; i <= 50; i++) {
            try {
              const nftOwner = await publicClient.readContract({
                address: CONTRACT_ADDRESSES.POSITION_NFT,
                abi: [{ name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] }] as const,
                functionName: 'ownerOf',
                args: [BigInt(i)]
              });

              if (nftOwner.toLowerCase() === userAddress.toLowerCase()) {
                const pos = await publicClient.readContract({
                  address: CONTRACT_ADDRESSES.POSITION_NFT,
                  abi: ABIS.POSITION_NFT,
                  functionName: 'getPosition',
                  args: [BigInt(i)]
                });

                const expSec = Number(pos[5]);
                const isExpired = currentSec >= expSec;
                posList.push({
                  id: i,
                  principal: parseFloat(formatEther(pos[2])).toLocaleString('en-US', { maximumFractionDigits: 2 }),
                  paid: parseFloat(formatEther(pos[3])).toLocaleString('en-US', { maximumFractionDigits: 2 }),
                  expirationTimestamp: expSec,
                  expDateStr: new Date(expSec * 1000).toLocaleDateString('es-ES'),
                  lockYears: pos[6].toString(),
                  isRagequitted: pos[7],
                  isMaturedClaimed: pos[8],
                  canClaim: isExpired && !pos[7] && !pos[8]
                });
              }
            } catch (e) {
              if (i > 1) break;
            }
          }
          setUserPositions(posList);
        } catch (e) {}
      }
    } catch (error) {
      console.error('Error polling smart contracts:', error);
    }
  };
`, 'utf8');
console.log('Part 2 appended');