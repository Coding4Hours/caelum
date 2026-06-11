interface WispOptions {
  hostname_blacklist?: Array<RegExp>;
  hostname_whitelist?: Array<RegExp>;
  port_blacklist?: (number | Array<number>)[];
  port_whitelist?: (number | Array<number>)[];
  allow_direct_ip?: boolean;
  allow_private_ips?: boolean;
  allow_loopback_ips?: boolean;
  stream_limit_per_host?: number;
  stream_limit_total?: number;
  allow_udp_streams?: boolean;
  allow_tcp_streams?: boolean;
  dns_ttl?: number;
  dns_method?: "lookup" | "resolve";
  dns_servers?: Array<string>;
  dns_result_order?: "ipv4first" | "ipv6first" | "verbatim";
  parse_real_ip?: boolean;
  parse_real_ip_from?: Array<string>;
}

interface Options {
  [key: string]: any;
  scramjet?: boolean;
  demoMode?: boolean;
  default?: string;
  wispOptions?: WispOptions;
}

interface BuildOptions extends Options {
  path?: string;
}

interface ChemicalServer {
  options: Options;
  server: import("node:http").Server;
  app: import("express").application;
}

interface ChemicalBuild {
  options: BuildOptions;
}
