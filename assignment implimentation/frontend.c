#include "employee.h"

int main() {
    printf("--- Employee ID Management System (CLI) ---\n");
    
    // Member 1's work
    ChainingTable* chain_db = init_chaining_db();
    OpenAddrTable* linear_db = init_open_db();
    OpenAddrTable* quad_db = init_open_db();
    
    int ids_to_insert[] = {1001, 2010, 3019, 4028, 5037}; // Example IDs causing collisions for a TABLE_SIZE 1009
    int num_ids = 5;
    
    int chain_cols = 0, lin_cols = 0, quad_cols = 0;
    
    printf("\nInserting Employee IDs and tracking collisions...\n");
    for(int i = 0; i < num_ids; i++) {
        // Member 2's work being called
        chain_cols += insert_chaining(chain_db, ids_to_insert[i]);
        lin_cols += insert_linear(linear_db, ids_to_insert[i]);
        quad_cols += insert_quadratic(quad_db, ids_to_insert[i]);
        printf("Inserted ID: %d\n", ids_to_insert[i]);
    }
    
    // Member 3's analysis output
    printf("\n--- Performance & Collision Report ---\n");
    printf("Total Collisions (Separate Chaining): %d\n", chain_cols);
    printf("Total Collisions (Linear Probing):    %d\n", lin_cols);
    printf("Total Collisions (Quadratic Probing): %d\n", quad_cols);
    
    printf("\nRecommendation: For search-heavy systems, Separate Chaining is recommended as it avoids primary clustering.\n");
    
    // Clean up memory
    free_chaining_db(chain_db);
    free_open_db(linear_db);
    free_open_db(quad_db);
    
    return 0;
}
