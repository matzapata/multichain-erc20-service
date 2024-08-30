import { JsonRpcProvider } from "@ethersproject/providers"
import { BigNumber, Contract, ContractFactory, ethers, Wallet } from "ethers"
import fs from "fs"

const config = {
    erc20ArtifactPath: "./contracts/artifacts/contracts/ERC20.sol/MyToken.json"
}
const erc20Artifact = JSON.parse(fs.readFileSync(config.erc20ArtifactPath, "utf8"));

interface ChainConfig {
    rpc: string
    wallet: string
}

class ChainService {

    constructor(
        private readonly config: { [chainId: string]: ChainConfig }
    ) { }

    getProvider(chainId: string): JsonRpcProvider {
        if (!this.config[chainId]) {
            throw new Error(`Chain ${chainId} not found`)
        }
        return new ethers.providers.JsonRpcProvider(this.config[chainId].rpc)
    }

    getSigner(chainId: string): Wallet {
        const provider = this.getProvider(chainId)
        return new ethers.Wallet(this.config[chainId].wallet, provider)
    }
}

class Erc20Service {
    private readonly contract: Contract;

    constructor(
        private readonly chainService: ChainService,
        private readonly address: string,
        private readonly chainId: string
    ) { 
        const signer = this.chainService.getSigner(this.chainId)
        this.contract = new Contract(this.address, erc20Artifact.abi, signer)
    }

    name(): Promise<string> {
        return this.contract.name()
    }

    symbol(): Promise<string> {
        return this.contract.symbol()
    }

    decimals(): Promise<number> {
        return this.contract.decimals()
    }

    totalSupply(): Promise<BigNumber> {
        return this.contract.totalSupply()
    }

    balanceOf(address: string): Promise<BigNumber> {
        return this.contract.balanceOf(address)
    }

    async mint(to: string, amount: BigNumber): Promise<ethers.providers.TransactionReceipt> {
        const provider = await this.chainService.getProvider(this.chainId)
        const gasPrice = await provider.getGasPrice();
        const gasLimit = await this.contract.estimateGas.mint(to, amount);

        return this.contract.mint(to, amount, {
            gasLimit,
            gasPrice
        })
    }

}

type DeployErc20Props = {
    name: string
    symbol: string
    decimals: number
    initialSupply: BigNumber
    chainId: string
}

// deploys ERC20
class Erc20Deployer {
    private erc20ContractFactory: ContractFactory

    constructor(
        private readonly chainService: ChainService,
    ) {
        this.erc20ContractFactory = new ethers.ContractFactory(erc20Artifact.abi, erc20Artifact.bytecode);
    }

    async deploy({
        name,
        symbol,
        decimals,
        initialSupply,
        chainId
    }: DeployErc20Props): Promise<string> {
        const wallet = this.chainService.getSigner(chainId)
        const provider = this.chainService.getProvider(chainId)
        const contractFactory = this.erc20ContractFactory.connect(wallet)

        // Deploy the contract with the specified name, symbol, decimals, and initial supply
        const contract = await contractFactory.deploy(name, symbol, decimals, initialSupply, {
            gasLimit: await contractFactory.signer.estimateGas(
                contractFactory.getDeployTransaction(name, symbol, decimals, initialSupply)
            ),
            gasPrice: await provider.getGasPrice(),
        });

        // Wait for the transaction to be mined
        await contract.deployed();

        return contract.address;
    }
}

const chainService = new ChainService({
    "137": {
        rpc: "https://polygon-mainnet.g.alchemy.com/v2/...",
        wallet: "..."
    }
})
const erc20Deployer = new Erc20Deployer(chainService)
const erc20Service = new Erc20Service(chainService, "0x1aE7800dac4a273b974e1EC483e0B5DE5B9e1710", "137")

// erc20Deployer.deploy({
//     name: "MyToken",
//     symbol: "MTK",
//     decimals: 18,
//     initialSupply: ethers.utils.parseUnits("1000", 18),
//     chainId: "137"
// }).then(console.log)

// erc20Service.name().then(console.log)
// erc20Service.symbol().then(console.log)
// erc20Service.decimals().then(console.log)
// erc20Service.totalSupply().then(console.log)
// erc20Service.balanceOf("0xF754D0f4de0e815b391D997Eeec5cD07E59858F0").then(console.log)
// erc20Service.mint("0xF754D0f4de0e815b391D997Eeec5cD07E59858F0", ethers.utils.parseUnits("1000", 18)).then(console.log)
