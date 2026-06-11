package com.example;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class ContactService {

    private static final String API_KEY = System.getenv("HUBSPOT_API_KEY");
    private static final int APP_ID = 39193691;
    private static final String CONTACTS_URL = "https://api.hubapi.com/crm/v3/objects/contacts";
    private static final String LINE_ITEMS_URL = "https://api.hubapi.com/crm/v3/objects/line_items";

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    public JsonNode createContact(Map<String, String> properties) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        ObjectNode props = body.putObject("properties");
        properties.forEach(props::put);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(CONTACTS_URL))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + API_KEY)
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode result = mapper.readTree(response.body());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new RuntimeException("HubSpot API error " + response.statusCode() + ": " +
                    result.path("message").asText(response.body()));
        }

        return result;
    }

    public JsonNode getContact(String contactId) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(CONTACTS_URL + "/" + contactId))
                .header("Authorization", "Bearer " + API_KEY)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode result = mapper.readTree(response.body());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new RuntimeException("HubSpot API error " + response.statusCode() + ": " +
                    result.path("message").asText(response.body()));
        }

        return result;
    }

    public JsonNode getContacts(List<String> contactIds) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        ArrayNode inputs = body.putArray("inputs");
        for (String id : contactIds) {
            inputs.addObject().put("id", id);
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(CONTACTS_URL + "/batch/read"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + API_KEY)
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode result = mapper.readTree(response.body());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new RuntimeException("HubSpot API error " + response.statusCode() + ": " +
                    result.path("message").asText(response.body()));
        }

        return result;
    }

    public List<JsonNode> getLineItemsForDeal(List<String> lineItemIds) throws Exception {
        List<JsonNode> results = new ArrayList<>();
        for (String id : lineItemIds) {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(LINE_ITEMS_URL + "/" + id))
                    .header("Authorization", "Bearer " + API_KEY)
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode result = mapper.readTree(response.body());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new RuntimeException("HubSpot API error " + response.statusCode() + ": " +
                        result.path("message").asText(response.body()));
            }

            results.add(result);
        }
        return results;
    }

    public static void main(String[] args) throws Exception {
        ContactService service = new ContactService();

        if (args.length > 0 && args[0].equals("get")) {
            String id = args.length > 1 ? args[1] : "1";
            System.out.println("Fetching contact " + id + "...");
            JsonNode contact = service.getContact(id);
            System.out.println(contact.toPrettyString());
            return;
        }

        if (args.length > 0 && args[0].equals("line-items")) {
            List<String> ids = List.of(args).subList(1, args.length);
            System.out.println("Fetching " + ids.size() + " line items one by one...");
            List<JsonNode> items = service.getLineItemsForDeal(ids);
            for (JsonNode item : items) {
                System.out.println(item.toPrettyString());
            }
            return;
        }

        Map<String, String> properties = Map.of(
                "email", "jane.doe@example.com",
                "firstname", "Jane",
                "lastname", "Doe",
                "phone", "555-123-4567"
        );

        System.out.println("Creating contact...");
        JsonNode contact = service.createContact(properties);
        System.out.println("Created contact ID: " + contact.path("id").asText());
        System.out.println("Full response: " + contact.toPrettyString());
    }
}
