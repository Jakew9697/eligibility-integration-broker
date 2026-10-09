import { readFileSync } from "node:fs";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ScreeningRequest, ScreeningResponse } from "../src/broker/contracts";
import { ELIGIBILITY_NS, LEGACY_PATH, SOAP_ACTION } from "../src/broker/soap";

const wsdl = readFileSync(new URL("../public/legacy-eligibility.wsdl", import.meta.url), "utf8");

describe("contracts", () => {
  it("the gateway schemas convert to JSON Schema for the Contracts view", () => {
    const req = z.toJSONSchema(ScreeningRequest, { io: "input" }) as any;
    expect(req.type).toBe("object");
    expect(Object.keys(req.properties)).toEqual(expect.arrayContaining(["householdSize", "members", "shelterCost", "dependentCareCost", "applicantRef"]));
    expect(req.properties.householdSize).toMatchObject({ minimum: 1, maximum: 12 });
    expect(z.toJSONSchema(ScreeningResponse).type).toBe("object");
  });

  it("the WSDL is well-formed and matches the service constants", () => {
    expect(XMLValidator.validate(wsdl)).toBe(true);
    const doc = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(wsdl);
    const defs = doc.definitions;
    expect(defs["@_targetNamespace"]).toBe(ELIGIBILITY_NS);
    expect(defs.portType.operation["@_name"]).toBe(SOAP_ACTION);
    expect(defs.binding.operation.operation["@_soapAction"]).toBe(SOAP_ACTION);
    expect(defs.service.port.address["@_location"]).toMatch(new RegExp(`${LEGACY_PATH}$`));
  });
});
