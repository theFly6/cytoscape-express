// src/data/Moore.ts

export const mooreDataStr = `         GPU0     GPU1     GPU2     GPU3     GPU4     GPU5     GPU6     GPU7     mlx5_1   mlx5_2   mlx5_3   mlx5_4   mlx5_5   CPU Affinity   NUMA Affinity  
GPU0     X        MPB      MPB      MPB      NODE     NODE     NODE     NODE     NODE     NODE     NODE     SYS      SYS      0-31,64-95     0              
GPU1     MPB      X        MPB      MPB      NODE     NODE     NODE     NODE     NODE     NODE     NODE     SYS      SYS      0-31,64-95     0              
GPU2     MPB      MPB      X        MPB      NODE     NODE     NODE     NODE     NODE     NODE     NODE     SYS      SYS      0-31,64-95     0              
GPU3     MPB      MPB      MPB      X        NODE     NODE     NODE     NODE     NODE     NODE     NODE     SYS      SYS      0-31,64-95     0              
GPU4     NODE     NODE     NODE     NODE     X        MPB      MPB      MPB      MPB      NODE     NODE     SYS      SYS      0-31,64-95     0              
GPU5     NODE     NODE     NODE     NODE     MPB      X        MPB      MPB      MPB      NODE     NODE     SYS      SYS      0-31,64-95     0              
GPU6     NODE     NODE     NODE     NODE     MPB      MPB      X        MPB      MPB      NODE     NODE     SYS      SYS      0-31,64-95     0              
GPU7     NODE     NODE     NODE     NODE     MPB      MPB      MPB      X        MPB      NODE     NODE     SYS      SYS      0-31,64-95     0              
mlx5_1   NODE     NODE     NODE     NODE     MPB      MPB      MPB      MPB      X        NODE     NODE     SYS      SYS      
mlx5_2   NODE     NODE     NODE     NODE     NODE     NODE     NODE     NODE     NODE     X        SPB      SYS      SYS      
mlx5_3   NODE     NODE     NODE     NODE     NODE     NODE     NODE     NODE     NODE     SPB      X        SYS      SYS      
mlx5_4   SYS      SYS      SYS      SYS      SYS      SYS      SYS      SYS      SYS      SYS      SYS      X        SPB      
mlx5_5   SYS      SYS      SYS      SYS      SYS      SYS      SYS      SYS      SYS      SYS      SYS      SPB      X        

Legend:
    X = Self
  SYS = Topology path that contains PCIe switches/bridges as well as multiple host bridges across NUMA nodes.
 NODE = Topology path that contains PCIe switches/bridges as well as multiple host bridges within a NUMA node.
  HPB = Topology path that contains PCIe switches/bridges as well as a single host bridge.
  MPB = Topology path that contains multiple PCIe switches/bridges (but no host bridge).
  SPB = Topology path that contains at most one PCIe switch/bridge.
  INT = Topology path that is created internally, for example 2 devices on a single S2000 card.
  MTx = Topology path that is a bonded set of x MTLinks.`